USE corte_certo;

CREATE TABLE IF NOT EXISTS bloqueios_agenda (
    id INT AUTO_INCREMENT PRIMARY KEY,
    barbeiro_id INT NOT NULL,
    data DATE NOT NULL,
    hora_inicio TIME NULL,
    hora_fim TIME NULL,
    motivo VARCHAR(255),
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (barbeiro_id) REFERENCES barbeiros(id) ON DELETE CASCADE,
    CONSTRAINT chk_janela_bloqueio CHECK (
        (hora_inicio IS NULL AND hora_fim IS NULL)
        OR (hora_inicio IS NOT NULL AND hora_fim IS NOT NULL AND hora_inicio < hora_fim)
    ),
    INDEX idx_barbeiro_data_bloqueio (barbeiro_id, data)
) ENGINE=InnoDB;
