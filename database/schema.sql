-- Corte Certo - Modelagem do banco de dados (MySQL 8+)
-- Uma única barbearia, vários barbeiros, expediente individual por barbeiro,
-- catálogo de serviços compartilhado por todos os barbeiros.

CREATE DATABASE IF NOT EXISTS corte_certo
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE corte_certo;

-- Identidade e autenticação de todos os usuários (clientes, barbeiros, admin).
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    role ENUM('cliente', 'barbeiro', 'admin') NOT NULL DEFAULT 'cliente',
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Extensão 1:1 de usuarios para quem tem role='barbeiro'.
-- Existe como tabela própria (em vez de FK direto em usuarios.id) para que
-- agendamentos e expedientes só possam apontar para quem é, de fato, barbeiro.
CREATE TABLE barbeiros (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL UNIQUE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    foto_url VARCHAR(255) NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Expediente semanal recorrente de cada barbeiro (dia da semana + janela de trabalho).
CREATE TABLE expedientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    barbeiro_id INT NOT NULL,
    dia_semana TINYINT NOT NULL COMMENT '0=domingo ... 6=sábado',
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,
    FOREIGN KEY (barbeiro_id) REFERENCES barbeiros(id) ON DELETE CASCADE,
    CONSTRAINT chk_dia_semana CHECK (dia_semana BETWEEN 0 AND 6),
    CONSTRAINT chk_janela_expediente CHECK (hora_inicio < hora_fim),
    UNIQUE KEY uniq_barbeiro_dia (barbeiro_id, dia_semana)
) ENGINE=InnoDB;

-- Catálogo de serviços, compartilhado por todos os barbeiros.
CREATE TABLE servicos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    duracao_minutos SMALLINT UNSIGNED NOT NULL,
    preco DECIMAL(10,2) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Agendamentos. hora_fim, duracao_minutos e preco_cobrado são congelados no
-- momento da criação a partir do serviço escolhido, para que uma mudança
-- posterior no catálogo (preço, duração) não altere agendamentos já feitos.
CREATE TABLE agendamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,
    barbeiro_id INT NOT NULL,
    servico_id INT NOT NULL,
    data DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,
    duracao_minutos SMALLINT UNSIGNED NOT NULL,
    preco_cobrado DECIMAL(10,2) NOT NULL,
    status ENUM('pendente', 'confirmado', 'cancelado', 'concluido') NOT NULL DEFAULT 'pendente',
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES usuarios(id),
    FOREIGN KEY (barbeiro_id) REFERENCES barbeiros(id),
    FOREIGN KEY (servico_id) REFERENCES servicos(id),
    CONSTRAINT chk_janela_agendamento CHECK (hora_inicio < hora_fim),
    INDEX idx_barbeiro_data (barbeiro_id, data)
) ENGINE=InnoDB;

-- Exceções pontuais ao expediente recorrente: feriado, folga, consulta
-- pessoal do barbeiro etc. hora_inicio/hora_fim NULL = dia inteiro bloqueado;
-- preenchidos = só aquela janela do dia. Não mexe no expediente semanal,
-- que continua representando a rotina normal do barbeiro.
CREATE TABLE bloqueios_agenda (
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
