-- Ani database (one database: aniyatrack)
-- Safe to import repeatedly: nothing is dropped except the columns this version
-- retired (users.email, users.status, plots.crop_type, plantings.crop_name).
-- phpMyAdmin: open the Import tab with no database selected and choose this file.

CREATE DATABASE IF NOT EXISTS aniyatrack
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE aniyatrack;

-- ---------------------------------------------------------------------
-- Tables. Plots, supplies and finance rows belong to one user (user_id);
-- everything else hangs off a plot or an item.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) DEFAULT NULL,
    username VARCHAR(30) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin','user') NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_role (role)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS plots (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED DEFAULT NULL,
    name VARCHAR(100) NOT NULL,
    status ENUM('Available','Planted','Maintenance') NOT NULL DEFAULT 'Available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_plot_user_name (user_id, name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS plantings (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    plot_id INT UNSIGNED NOT NULL,
    variety VARCHAR(150) DEFAULT NULL,
    planted_date DATE NOT NULL,
    expected_harvest_date DATE DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_planting_plot FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE CASCADE,
    INDEX idx_planting_date (planted_date),
    INDEX idx_expected_harvest (expected_harvest_date)
) ENGINE=InnoDB;

-- Farm tasks of every type (the table keeps its original name).
CREATE TABLE IF NOT EXISTS watering_tasks (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    plot_id INT UNSIGNED NOT NULL,
    task_date DATE NOT NULL,
    task_type ENUM('Water','Fertilize','Weed','Pest Control','Inspect','Other') NOT NULL DEFAULT 'Water',
    done TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_watering_plot FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE CASCADE,
    INDEX idx_task_date_done (task_date, done)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS harvests (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    plot_id INT UNSIGNED NOT NULL,
    harvest_date DATE NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    notes VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_harvest_plot FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE CASCADE,
    INDEX idx_harvest_date (harvest_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS finance_transactions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED DEFAULT NULL,
    plot_id INT UNSIGNED DEFAULT NULL,
    transaction_type ENUM('Expense','Income') NOT NULL,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    transaction_date DATE NOT NULL,
    notes VARCHAR(500) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_finance_plot FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE SET NULL,
    INDEX idx_finance_date (transaction_date),
    INDEX idx_finance_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED DEFAULT NULL,
    item_name VARCHAR(150) NOT NULL,
    category ENUM('Rice Seeds','Fertilizers','Pesticides','Other Supplies') NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
    unit VARCHAR(30) NOT NULL DEFAULT 'kg',
    purchase_date DATE NOT NULL,
    threshold DECIMAL(10,2) NOT NULL DEFAULT 0,
    cost DECIMAL(12,2) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_inventory_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory_usage_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    item_id INT UNSIGNED NOT NULL,
    quantity_used DECIMAL(10,2) NOT NULL,
    used_date DATE NOT NULL,
    plot_id INT UNSIGNED DEFAULT NULL,
    purpose VARCHAR(255) DEFAULT NULL,
    logged_by VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usage_item FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_usage_plot FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE SET NULL,
    INDEX idx_item_date (item_id, used_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS activity_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED DEFAULT NULL,
    username VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_log_created (created_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Upgrade an older database. Each step checks first, so it is skipped
-- when already applied.
-- ---------------------------------------------------------------------

-- Email was removed from accounts
SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email'),
    'ALTER TABLE users DROP COLUMN email',
    'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Activate / deactivate was removed, so the status column is gone too
SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'status'),
    'ALTER TABLE users DROP COLUMN status',
    'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ani only tracks rice, so the crop columns are gone
SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plots' AND COLUMN_NAME = 'crop_type'),
    'ALTER TABLE plots DROP COLUMN crop_type',
    'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plantings' AND COLUMN_NAME = 'crop_name'),
    'ALTER TABLE plantings DROP COLUMN crop_name',
    'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- "Occupied" was a duplicate of "Planted"
UPDATE plots SET status = 'Planted' WHERE status = 'Occupied';
ALTER TABLE plots
    MODIFY COLUMN status ENUM('Available','Planted','Maintenance') NOT NULL DEFAULT 'Available';

-- ---------------------------------------------------------------------
-- Starter accounts (no sample farm data).
--   admin   / admin123   -> Administrator portal
--   farmer1 / admin123   -> Farmer dashboard
-- ---------------------------------------------------------------------
INSERT IGNORE INTO users (id, full_name, phone, username, password_hash, role) VALUES
(1, 'System Administrator', '09123456789', 'admin',   '$2y$10$zoNQFRXSP6wNugkS082EAu/kb1V/jPE9G4AHtPUSGj7EVqy2G3uFa', 'admin'),
(2, 'Farmer Juan',          '09987654321', 'farmer1', '$2y$10$zoNQFRXSP6wNugkS082EAu/kb1V/jPE9G4AHtPUSGj7EVqy2G3uFa', 'user');

UPDATE users SET role = 'admin' WHERE username = 'admin';

INSERT INTO activity_logs (user_id, username, action, details)
SELECT 1, 'admin', 'System Initialized', 'Database and default admin account configured'
WHERE NOT EXISTS (SELECT 1 FROM activity_logs WHERE action = 'System Initialized');

-- ---------------------------------------------------------------------
-- Optional, upgrading from the old version only: its separate "seeds" table
-- is no longer used (seeds now live in inventory_items). Remove the leading
-- dashes to delete it once you have checked nothing there is still needed.
-- ---------------------------------------------------------------------
-- DROP TABLE IF EXISTS seeds;
