-- process_recurring_transactions: the user's local date, the template's account,
-- custom split amounts, and only people the payer can still charge.
--
-- Requires 202610010100 (recurring_templates.account_id, can_split_on).
--
-- WHY
--   * CURRENT_DATE is the server's (UTC) date. For a user in the Americas the
--     processor posted tomorrow's bill in the evening; for one east of UTC it
--     posted today's only after UTC midnight. It now uses profiles.timezone,
--     falling back to UTC when it is missing or not a name Postgres knows.
--   * The template had no account, so every recurring post landed in the primary
--     account (audit #17). It now copies recurring_templates.account_id; NULL still
--     falls through to the transactions_set_default_account trigger.
--   * Recurring splits only stored friend_ids, so a custom split became an even one
--     on every later occurrence. The client now stores
--     metadata.split_amounts = [{"user_id": uuid, "amount": number}] for a custom
--     split; those amounts are used verbatim. If they add up to more than the
--     template amount (the amount was edited down afterwards) the occurrence falls
--     back to the even split rather than overcharging.
--   * friend_ids were charged forever, unfriended or not. Each debtor now has to
--     pass can_split_on at post time. A dropped friend's share is absorbed by the
--     payer — the remaining friends' shares stay what they agreed to (divisor is
--     still the original friend count + 1).
--   * A group template divided by the group's current member count and charged
--     every member other than the payer, even after the payer had left the group.
--     If the payer is no longer a member the occurrence is posted as a personal
--     expense (group_id NULL) with no splits: the bill still happened, but the
--     group no longer owes it. The 202610010100 trigger would reject the group_id
--     anyway, and a RAISE here would fail every later run for this user.
--   * The same applies to a bucket the user can no longer see: dropped, not raised.
--   * Malformed metadata (a non-UUID friend id, a non-numeric amount) used to abort
--     the whole run — and therefore every template's posting — on every app load.
--     Those elements are now skipped.
--
-- The rest of the body is copied forward from 202608220100_secure_definer_rpcs.sql.

CREATE OR REPLACE FUNCTION public.process_recurring_transactions(user_id_input UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    template_record    RECORD;
    new_transaction_id UUID;
    process_date       DATE;
    split_amt          NUMERIC;
    friend_ids_json    JSONB;
    split_amounts_json JSONB;
    split_amounts_sum  NUMERIC;
    member_count       INT;
    next_month_start   DATE;
    days_in_next_month INT;
    target_day         INT;
    template_tags      TEXT[];
    v_tz               TEXT;
    v_today            DATE;
    v_group_id         UUID;
    v_bucket_text      TEXT;
    v_bucket_id        UUID;
    v_is_split         BOOLEAN;
    c_uuid_re CONSTANT TEXT := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
BEGIN
    IF auth.uid() IS NULL OR user_id_input <> auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: cannot process recurring transactions for another user';
    END IF;

    SELECT p.timezone INTO v_tz FROM public.profiles p WHERE p.id = user_id_input;
    IF v_tz IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_tz) THEN
        v_tz := 'UTC';
    END IF;
    v_today := (now() AT TIME ZONE v_tz)::DATE;

    FOR template_record IN
        SELECT * FROM public.recurring_templates
        WHERE user_id = user_id_input AND is_active = TRUE AND next_occurrence <= v_today
        FOR UPDATE
    LOOP
        process_date := template_record.next_occurrence;

        -- Tags from template metadata, if any.
        template_tags := '{}'::TEXT[];
        IF template_record.metadata ? 'tags'
           AND jsonb_typeof(template_record.metadata->'tags') = 'array' THEN
            SELECT array_agg(value)
            INTO template_tags
            FROM jsonb_array_elements_text(template_record.metadata->'tags') AS value
            WHERE value IS NOT NULL AND length(trim(value)) > 0;
            template_tags := COALESCE(template_tags, '{}'::TEXT[]);
        END IF;

        -- Group: only while the payer is still a member.
        v_group_id := NULL;
        IF template_record.group_id IS NOT NULL
           AND public.is_group_member(template_record.group_id, template_record.user_id) THEN
            v_group_id := template_record.group_id;
        END IF;

        -- Bucket: only one the payer can still see.
        v_bucket_id   := NULL;
        v_bucket_text := template_record.metadata->>'bucket_id';
        IF v_bucket_text ~ c_uuid_re THEN
            SELECT b.id INTO v_bucket_id
            FROM public.buckets b
            WHERE b.id = v_bucket_text::UUID
              AND (b.user_id = template_record.user_id
                   OR (b.group_id IS NOT NULL AND public.is_group_member(b.group_id, template_record.user_id)));
        END IF;

        v_is_split := COALESCE(template_record.metadata->>'is_split' = 'true', FALSE)
                      AND NOT COALESCE(template_record.is_income, FALSE)
                      -- A group template whose payer left posts unsplit.
                      AND NOT (template_record.group_id IS NOT NULL AND v_group_id IS NULL);

        WHILE process_date <= v_today LOOP

            IF NOT EXISTS (
                SELECT 1 FROM public.transactions
                WHERE user_id = template_record.user_id
                  AND description = template_record.description
                  AND amount = template_record.amount
                  AND date = process_date
            ) THEN
                INSERT INTO public.transactions (
                    user_id, amount, description, category, date, payment_method,
                    notes, currency, group_id, bucket_id, account_id, base_currency,
                    exchange_rate, converted_amount, is_recurring, is_income,
                    exclude_from_allowance,
                    place_name, place_address, place_lat, place_lng, tags
                ) VALUES (
                    template_record.user_id,
                    template_record.amount,
                    template_record.description,
                    template_record.category,
                    process_date,
                    template_record.payment_method,
                    template_record.metadata->>'notes',
                    template_record.currency,
                    v_group_id,
                    v_bucket_id,
                    template_record.account_id,
                    template_record.currency,
                    1,
                    template_record.amount,
                    TRUE,
                    COALESCE(template_record.is_income, FALSE),
                    COALESCE(template_record.exclude_from_allowance, FALSE),
                    NULLIF(template_record.metadata->>'place_name', ''),
                    NULLIF(template_record.metadata->>'place_address', ''),
                    (NULLIF(template_record.metadata->>'place_lat', ''))::NUMERIC,
                    (NULLIF(template_record.metadata->>'place_lng', ''))::NUMERIC,
                    template_tags
                )
                RETURNING id INTO new_transaction_id;

                IF v_is_split THEN
                    -- Custom amounts, if the template carries usable ones. CASE (not AND)
                    -- guards each cast: WHERE clauses do not short-circuit in order.
                    split_amounts_json := template_record.metadata->'split_amounts';
                    split_amounts_sum  := NULL;
                    IF jsonb_typeof(split_amounts_json) = 'array'
                       AND jsonb_array_length(split_amounts_json) > 0 THEN
                        SELECT COALESCE(sum(
                            CASE WHEN jsonb_typeof(e) = 'object'
                                      AND jsonb_typeof(e->'amount') = 'number'
                                      AND (e->>'user_id') ~ c_uuid_re
                                 THEN (e->>'amount')::NUMERIC END
                        ), 0)
                        INTO split_amounts_sum
                        FROM jsonb_array_elements(split_amounts_json) AS e;
                    END IF;

                    IF split_amounts_sum IS NOT NULL
                       AND split_amounts_sum > 0
                       AND split_amounts_sum <= template_record.amount + 0.01 THEN
                        INSERT INTO public.splits (transaction_id, user_id, amount, is_paid)
                        SELECT new_transaction_id, (e->>'user_id')::UUID, (e->>'amount')::NUMERIC, FALSE
                        FROM jsonb_array_elements(split_amounts_json) AS e
                        WHERE CASE WHEN jsonb_typeof(e) = 'object'
                                        AND jsonb_typeof(e->'amount') = 'number'
                                        AND (e->>'user_id') ~ c_uuid_re
                                   THEN (e->>'amount')::NUMERIC > 0
                                        AND public.can_split_on(new_transaction_id, (e->>'user_id')::UUID)
                                   ELSE FALSE END;

                    ELSIF v_group_id IS NOT NULL THEN
                        -- Current membership, payer included (guaranteed a member above).
                        SELECT count(*) INTO member_count
                        FROM public.group_members WHERE group_id = v_group_id;

                        INSERT INTO public.splits (transaction_id, user_id, amount, is_paid)
                        SELECT new_transaction_id, gm.user_id, template_record.amount / member_count, FALSE
                        FROM public.group_members gm
                        WHERE gm.group_id = v_group_id
                          AND gm.user_id <> template_record.user_id;

                    ELSE
                        friend_ids_json := template_record.metadata->'friend_ids';
                        IF jsonb_typeof(friend_ids_json) = 'array'
                           AND jsonb_array_length(friend_ids_json) > 0 THEN
                            split_amt := template_record.amount / (jsonb_array_length(friend_ids_json) + 1);
                            INSERT INTO public.splits (transaction_id, user_id, amount, is_paid)
                            SELECT new_transaction_id, f::UUID, split_amt, FALSE
                            FROM jsonb_array_elements_text(friend_ids_json) AS f
                            WHERE CASE WHEN f ~ c_uuid_re
                                       THEN public.can_split_on(new_transaction_id, f::UUID)
                                       ELSE FALSE END;
                        END IF;
                    END IF;
                END IF;
            END IF;

            IF template_record.frequency = 'daily' THEN
                process_date := process_date + INTERVAL '1 day';
            ELSIF template_record.frequency = 'weekly' THEN
                process_date := process_date + INTERVAL '7 days';
            ELSIF template_record.frequency = 'monthly' THEN
                next_month_start   := date_trunc('month', process_date + INTERVAL '1 month')::DATE;
                days_in_next_month := EXTRACT(DAY FROM (next_month_start + INTERVAL '1 month' - INTERVAL '1 day'))::INT;
                target_day         := LEAST(
                    COALESCE(template_record.intended_day, EXTRACT(DAY FROM process_date)::INT),
                    days_in_next_month
                );
                process_date := (next_month_start + (target_day - 1) * INTERVAL '1 day')::DATE;
            ELSIF template_record.frequency = 'yearly' THEN
                process_date := (process_date + INTERVAL '1 year')::DATE;
            ELSE
                EXIT;
            END IF;

        END LOOP;

        UPDATE public.recurring_templates
        SET next_occurrence = process_date, updated_at = NOW()
        WHERE id = template_record.id;

    END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_recurring_transactions(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_recurring_transactions(UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.process_recurring_transactions(UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.process_recurring_transactions(UUID) TO service_role;
