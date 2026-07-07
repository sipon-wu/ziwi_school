-- Copy password hash from working teacher(13800000002, password=teacher123) to problematic accounts
UPDATE users SET password_hash = (SELECT password_hash FROM users WHERE phone = '13800000002' LIMIT 1) WHERE phone IN ('13800000004', '13800000005');
SELECT phone, name, role, length(password_hash) FROM users WHERE phone IN ('13800000002', '13800000004', '13800000005');
