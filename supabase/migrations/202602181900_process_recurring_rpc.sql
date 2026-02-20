-- RPC to process recurring transactions for a user
-- Created: 2026-02-18 19:00

CREATE OR REPLACE FUNCTION process_recurring_transactions(user_id_input UUID)
RETURNS VOID AS $$
DECLARE
    template_record RECORD;
    new_transaction_id UUID;
    process_date DATE;
    debtor_id UUID;
    split_amt NUMERIC;
    friend_ids_json JSONB;
BEGIN
    FOR template_record IN 
        SELECT * FROM recurring_templates 
        WHERE user_id = user_id_input AND is_active = TRUE AND next_occurrence <= CURRENT_DATE
        FOR UPDATE
    LOOP
        process_date := template_record.next_occurrence;
        
        WHILE process_date <= CURRENT_DATE LOOP
            -- 1. Insert Transaction (with duplicate check)
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
                    exchange_rate, converted_amount, is_recurring
                )
                VALUES (
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
                    TRUE
                )
                RETURNING id INTO new_transaction_id;

                -- 2. Handle Splits (only if transaction was inserted)
                IF (template_record.metadata->>'is_split')::BOOLEAN = TRUE THEN
                    IF template_record.group_id IS NOT NULL THEN
                        INSERT INTO splits (transaction_id, user_id, amount, is_paid)
                        SELECT 
                            new_transaction_id, 
                            gm.user_id, 
                            template_record.amount / (SELECT count(*) FROM group_members WHERE group_id = template_record.group_id),
                            FALSE
                        FROM group_members gm
                        WHERE gm.group_id = template_record.group_id AND gm.user_id != template_record.user_id;
                    ELSE
                        friend_ids_json := template_record.metadata->'friend_ids';
                        IF friend_ids_json IS NOT NULL AND jsonb_array_length(friend_ids_json) > 0 THEN
                            split_amt := template_record.amount / (jsonb_array_length(friend_ids_json) + 1);
                            
                            FOR debtor_id IN SELECT jsonb_array_elements_text(friend_ids_json)::UUID
                            LOOP
                                INSERT INTO splits (transaction_id, user_id, amount, is_paid)
                                VALUES (new_transaction_id, debtor_id, split_amt, FALSE);
                            END LOOP;
                        END IF;
                    END IF;
                END IF;
            END IF;

            -- Advance process_date
            IF template_record.frequency = 'daily' THEN process_date := process_date + INTERVAL '1 day';
            ELSIF template_record.frequency = 'weekly' THEN process_date := process_date + INTERVAL '7 days';
            ELSIF template_record.frequency = 'monthly' THEN process_date := (process_date + INTERVAL '1 month')::DATE;
            ELSIF template_record.frequency = 'yearly' THEN process_date := (process_date + INTERVAL '1 year')::DATE;
            ELSE EXIT; -- Safety break
            END IF;
        END LOOP;

        -- Update next_occurrence to the next future date
        UPDATE recurring_templates 
        SET next_occurrence = process_date, updated_at = NOW()
        WHERE id = template_record.id;

    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
