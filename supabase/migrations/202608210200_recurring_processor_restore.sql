-- Migration: restore clamping, location, tags and allowance in the recurring processor
-- Date: 2026-08-21
--
-- 202605070100_recurring_income.sql redefined process_recurring_transactions to
-- add is_income, but rebuilt it from an older body and silently reverted three
-- earlier fixes. It runs on every app load (UserPreferencesProvider), so all of
-- this has been live since 2026-05-07:
--
--   * Month-end drift. The monthly branch went back to a bare
--     (process_date + INTERVAL '1 month'), so a template on the 31st walked
--     Jan 31 -> Feb 28 -> Mar 28 and stayed on the 28th forever. The clamping
--     added in 202603200000 is restored, and `intended_day` — still written by
--     the client and by the RPC, and read by nobody since May — matters again.
--
--   * Location was dropped, so auto-posted rows vanished from the map view and
--     from place-based smart defaults.
--
--   * Tags were dropped, so template tags were stored and never applied.
--
-- And one thing no version ever did:
--
--   * exclude_from_allowance was never propagated. Setting "Exclude from
--     Allowance" on a recurring bill only ever excluded the first occurrence;
--     every auto-posted month counted against the monthly allowance.
--
-- This is the 2026-05-03 body (the last correct one) plus is_income and the
-- income-can't-be-split guard from 2026-05-07, plus exclude_from_allowance.
--
-- base_currency/exchange_rate/converted_amount are deliberately left as they
-- are. Postgres has no live-rate access here, and resolveAmountIn already treats
-- exchange_rate = 1 and a converted_amount mirroring amount as failed-lookup
-- signals and falls back to a live rate at read time. Writing a real base
-- currency with a fake 1.0 rate would not improve on that.

CREATE OR REPLACE FUNCTION process_recurring_transactions(user_id_input UUID)
RETURNS VOID AS $$
DECLARE
    template_record   RECORD;
    new_transaction_id UUID;
    process_date      DATE;
    debtor_id         UUID;
    split_amt         NUMERIC;
    friend_ids_json   JSONB;
    next_month_start  DATE;
    days_in_next_month INT;
    target_day        INT;
    template_tags     TEXT[];
BEGIN
    FOR template_record IN
        SELECT * FROM recurring_templates
        WHERE user_id = user_id_input AND is_active = TRUE AND next_occurrence <= CURRENT_DATE
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

        WHILE process_date <= CURRENT_DATE LOOP

            IF NOT EXISTS (
                SELECT 1 FROM transactions
                WHERE user_id = template_record.user_id
                  AND description = template_record.description
                  AND amount = template_record.amount
                  AND date = process_date
            ) THEN
                INSERT INTO transactions (
                    user_id, amount, description, category, date, payment_method,
                    notes, currency, group_id, bucket_id, base_currency,
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
                    template_record.group_id,
                    (NULLIF(template_record.metadata->>'bucket_id', 'null'))::UUID,
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

                IF (template_record.metadata->>'is_split')::BOOLEAN = TRUE
                   AND COALESCE(template_record.is_income, FALSE) = FALSE THEN
                    IF template_record.group_id IS NOT NULL THEN
                        INSERT INTO splits (transaction_id, user_id, amount, is_paid)
                        SELECT
                            new_transaction_id,
                            gm.user_id,
                            template_record.amount / (
                                SELECT count(*) FROM group_members WHERE group_id = template_record.group_id
                            ),
                            FALSE
                        FROM group_members gm
                        WHERE gm.group_id = template_record.group_id
                          AND gm.user_id <> template_record.user_id;
                    ELSE
                        friend_ids_json := template_record.metadata->'friend_ids';
                        IF friend_ids_json IS NOT NULL AND jsonb_array_length(friend_ids_json) > 0 THEN
                            split_amt := template_record.amount / (jsonb_array_length(friend_ids_json) + 1);
                            FOR debtor_id IN
                                SELECT jsonb_array_elements_text(friend_ids_json)::UUID
                            LOOP
                                INSERT INTO splits (transaction_id, user_id, amount, is_paid)
                                VALUES (new_transaction_id, debtor_id, split_amt, FALSE);
                            END LOOP;
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

        UPDATE recurring_templates
        SET next_occurrence = process_date, updated_at = NOW()
        WHERE id = template_record.id;

    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
