CREATE DATABASE ani
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
USE ani;
CREATE TABLE users (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    first_name    VARCHAR(100) NOT NULL,
    last_name     VARCHAR(100) NOT NULL DEFAULT '',
    phone         VARCHAR(30)  DEFAULT NULL,
    username      VARCHAR(30)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('admin','user') NOT NULL DEFAULT 'user',
    status        ENUM('active','pending','rejected') NOT NULL DEFAULT 'active',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE seeds (
    seed_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED DEFAULT NULL,
    seed_name   VARCHAR(150) NOT NULL,
    quantity_g  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    threshold_g DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    seed_type   ENUM('160','152','480','402','436','RC18','RC10','Hybrid') DEFAULT NULL,
    UNIQUE KEY uq_seeds_seed_type (seed_type),
    INDEX idx_seed_user (user_id),
    CONSTRAINT fk_seeds_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;
INSERT INTO seeds (seed_id, user_id, seed_name, quantity_g, threshold_g, created_at, seed_type) VALUES
    (1, NULL, '160',    0.00, 0.00, '2026-11-18 06:13:39', '160'),
    (2, NULL, '152',    0.00, 0.00, '2026-11-18 06:13:39', '152'),
    (3, NULL, '480',    0.00, 0.00, '2026-11-18 06:13:39', '480'),
    (4, NULL, '402',    0.00, 0.00, '2026-11-18 06:13:39', '402'),
    (5, NULL, '436',    0.00, 0.00, '2026-11-18 06:13:39', '436'),
    (6, NULL, 'RC18',   0.00, 0.00, '2026-11-18 06:13:39', 'RC18'),
    (7, NULL, 'RC10',   0.00, 0.00, '2026-11-18 06:13:39', 'RC10'),
    (8, NULL, 'Hybrid', 0.00, 0.00, '2026-11-18 06:13:39', 'Hybrid');
CREATE TABLE plots (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id    INT UNSIGNED DEFAULT NULL,
    seed_id    INT UNSIGNED DEFAULT NULL,
    updated_by INT UNSIGNED DEFAULT NULL,
    name       VARCHAR(100) NOT NULL,
    status     ENUM('Available','Planted','Maintenance','Occupied','Harvested') NOT NULL DEFAULT 'Available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    seed_type  ENUM('160','152','480','402','436','RC18','RC10','Hybrid') DEFAULT NULL,
    UNIQUE KEY uq_plot_user_name (user_id, name),
    INDEX idx_plot_seed (seed_id),
    INDEX idx_plot_updated_by (updated_by),
    INDEX fk_plots_seed_type (seed_type),
    CONSTRAINT fk_plots_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_plot_seed
        FOREIGN KEY (seed_id) REFERENCES seeds(seed_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_plot_updated_by
        FOREIGN KEY (updated_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_plots_seed_type
        FOREIGN KEY (seed_type) REFERENCES seeds(seed_type)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;
CREATE TABLE plantings (
    id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    plot_id               INT UNSIGNED NOT NULL,
    variety               VARCHAR(150) DEFAULT NULL,
    planted_date          DATE NOT NULL,
    expected_harvest_date DATE DEFAULT NULL,
    notes                 TEXT DEFAULT NULL,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    seed_type             ENUM('160','152','480','402','436','RC18','RC10','Hybrid') DEFAULT NULL,
    INDEX idx_planting_plot (plot_id),
    INDEX idx_expected_harvest (expected_harvest_date),
    INDEX fk_plantings_seed_type (seed_type),
    CONSTRAINT fk_planting_plot
        FOREIGN KEY (plot_id) REFERENCES plots(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_plantings_seed_type
        FOREIGN KEY (seed_type) REFERENCES seeds(seed_type)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;
CREATE TABLE tasks (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    plot_id    INT UNSIGNED NOT NULL,
    task_date  DATE NOT NULL,
    task_type  ENUM('Water','Fertilize','Weed','Pest Control','Inspect','Other')
               NOT NULL DEFAULT 'Water',
    updated_by INT UNSIGNED DEFAULT NULL,
    done       TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_task_date_done (task_date, done),
    INDEX idx_task_updated_by (updated_by),
    CONSTRAINT fk_task_plot
        FOREIGN KEY (plot_id) REFERENCES plots(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_task_updated_by
        FOREIGN KEY (updated_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;
CREATE TABLE harvests (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    plot_id      INT UNSIGNED NOT NULL,
    planting_id  INT UNSIGNED DEFAULT NULL,
    harvest_date DATE NOT NULL,
    quantity     DECIMAL(10,2) NOT NULL,
    measurement  ENUM('kg','g','sacks','bottles','pcs','tons','liters')
                 NOT NULL DEFAULT 'kg',
    notes        VARCHAR(255) DEFAULT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_harvest_date (harvest_date),
    INDEX idx_harvest_planting (planting_id),
    CONSTRAINT fk_harvest_plot
        FOREIGN KEY (plot_id) REFERENCES plots(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_harvest_planting
        FOREIGN KEY (planting_id) REFERENCES plantings(id)
        ON UPDATE CASCADE
) ENGINE=InnoDB;
CREATE TABLE inventory_items (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id       INT UNSIGNED DEFAULT NULL,
    item_name     VARCHAR(150) NOT NULL,
    category      ENUM('Rice Seeds','Fertilizers','Pesticides','Other Supplies') NOT NULL,
    quantity      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    unit          VARCHAR(30) NOT NULL DEFAULT 'kg',
    purchase_date DATE NOT NULL,
    threshold     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    cost          DECIMAL(12,2) DEFAULT NULL,
    notes         TEXT DEFAULT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_inventory_user (user_id),
    CONSTRAINT fk_inventory_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;
CREATE TABLE inventory_usage_logs (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    item_id       INT UNSIGNED NOT NULL,
    quantity_used DECIMAL(10,2) NOT NULL,
    used_date     DATE NOT NULL,
    plot_id       INT UNSIGNED DEFAULT NULL,
    purpose       VARCHAR(255) DEFAULT NULL,
    logged_by     VARCHAR(100) DEFAULT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_item_date (item_id, used_date),
    CONSTRAINT fk_usage_item
        FOREIGN KEY (item_id) REFERENCES inventory_items(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_usage_plot
        FOREIGN KEY (plot_id) REFERENCES plots(id)
        ON DELETE SET NULL
) ENGINE=InnoDB;
CREATE TABLE finance_transactions (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id          INT UNSIGNED DEFAULT NULL,
    plot_id          INT UNSIGNED DEFAULT NULL,
    transaction_type ENUM('Expense','Income') NOT NULL,
    category         VARCHAR(100) NOT NULL,
    amount           DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    transaction_date DATE NOT NULL,
    notes            VARCHAR(500) DEFAULT NULL,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_finance_date (transaction_date),
    INDEX idx_finance_user (user_id),
    CONSTRAINT fk_finance_plot
        FOREIGN KEY (plot_id) REFERENCES plots(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_finance_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;
CREATE TABLE activity_logs (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id    INT UNSIGNED DEFAULT NULL,
    username   VARCHAR(50) NOT NULL,
    action     VARCHAR(100) NOT NULL,
    details    TEXT DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_log_created (created_at),
    INDEX idx_log_action (action),
    CONSTRAINT fk_activity_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;
INSERT INTO users (first_name, last_name, phone, username, password_hash, role, status) VALUES
('Administrator', '', NULL, 'admin',
 '$2b$12$Fh4O8ArHk4CZ3sK2TlVmgen//ieAU1Z6ZgtMBJR//BIxlo.Ac9QDS', 'admin', 'active');
