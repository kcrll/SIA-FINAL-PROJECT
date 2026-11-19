-- ============================================================
-- Ani (AniyaTrack) database
-- Import this file in phpMyAdmin (Import tab). It drops and
-- recreates every table, so it is safe to re-import.
-- Default accounts: admin / admin123   and   farmer1 / admin123
-- ============================================================

CREATE DATABASE IF NOT EXISTS ani
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE ani;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS finance_transactions;
DROP TABLE IF EXISTS inventory_usage_logs;
DROP TABLE IF EXISTS inventory_items;
DROP TABLE IF EXISTS harvests;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS watering_tasks;   -- old table, replaced by tasks
DROP TABLE IF EXISTS seeds;            -- old table, replaced by inventory_items
DROP TABLE IF EXISTS plantings;
DROP TABLE IF EXISTS plots;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. USERS
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

-- 2. PLOTS
CREATE TABLE plots (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id    INT UNSIGNED DEFAULT NULL,
    name       VARCHAR(100) NOT NULL,
    status     ENUM('Available','Planted','Maintenance') NOT NULL DEFAULT 'Available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_plot_user_name (user_id, name),

    CONSTRAINT fk_plots_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 3. PLANTINGS
CREATE TABLE plantings (
    id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    plot_id               INT UNSIGNED NOT NULL,
    variety               VARCHAR(150) DEFAULT NULL,
    planted_date          DATE NOT NULL,
    expected_harvest_date DATE DEFAULT NULL,
    notes                 TEXT DEFAULT NULL,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_planting_plot (plot_id),
    INDEX idx_expected_harvest (expected_harvest_date),

    CONSTRAINT fk_planting_plot
        FOREIGN KEY (plot_id) REFERENCES plots(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. TASKS (water, fertilize, weed, ...)
CREATE TABLE tasks (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    plot_id    INT UNSIGNED NOT NULL,
    task_date  DATE NOT NULL,
    task_type  ENUM('Water','Fertilize','Weed','Pest Control','Inspect','Other')
               NOT NULL DEFAULT 'Water',
    done       TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_task_date_done (task_date, done),

    CONSTRAINT fk_task_plot
        FOREIGN KEY (plot_id) REFERENCES plots(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. HARVESTS
CREATE TABLE harvests (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    plot_id      INT UNSIGNED NOT NULL,
    harvest_date DATE NOT NULL,
    quantity     DECIMAL(10,2) NOT NULL,
    notes        VARCHAR(255) DEFAULT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_harvest_date (harvest_date),

    CONSTRAINT fk_harvest_plot
        FOREIGN KEY (plot_id) REFERENCES plots(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. INVENTORY ITEMS (rice seeds, fertilizers, pesticides, other supplies)
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

-- 7. INVENTORY USAGE LOGS
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

-- 8. FINANCE TRANSACTIONS
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

-- 9. ACTIVITY LOGS
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

-- ============================================================
-- Starter accounts (password for both: admin123)
-- ============================================================
INSERT INTO users (first_name, last_name, phone, username, password_hash, role, status) VALUES
('Administrator', '', NULL, 'admin',
 '$2b$12$Fh4O8ArHk4CZ3sK2TlVmgen//ieAU1Z6ZgtMBJR//BIxlo.Ac9QDS', 'admin', 'active'),
('Farmer', 'One', '09123456789', 'farmer1',
 '$2b$12$Fh4O8ArHk4CZ3sK2TlVmgen//ieAU1Z6ZgtMBJR//BIxlo.Ac9QDS', 'user', 'active');
