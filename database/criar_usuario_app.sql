-- Usuário de aplicação com privilégios restritos ao banco corte_certo.
-- Rodar como root, depois de aplicar schema.sql.
CREATE USER IF NOT EXISTS 'corte_certo_app'@'localhost' IDENTIFIED BY 'corte_certo_dev_2026';
GRANT SELECT, INSERT, UPDATE, DELETE ON corte_certo.* TO 'corte_certo_app'@'localhost';
FLUSH PRIVILEGES;
