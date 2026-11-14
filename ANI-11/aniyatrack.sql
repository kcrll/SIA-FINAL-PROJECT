CREATE DATABASE aniyatrack
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE aniyatrack;


-- 1. USERS
CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) DEFAULT NULL,
    username VARCHAR(30) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    status ENUM('active', 'deactivated', 'pending', 'rejected') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_role (role),
    INDEX idx_user_status (status)
) ENGINE=InnoDB;


-- 2. PLOTS
CREATE TABLE plots (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED DEFAULT NULL,
    name VARCHAR(100) NOT NULL,
    crop_type ENUM('Rice') NOT NULL DEFAULT 'Rice',
    status ENUM('Available', 'Planted', 'Occupied', 'Maintenance') NOT NULL DEFAULT 'Available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_plot_user_name (user_id, name)
) ENGINE=InnoDB;


-- 3. PLANTINGS
CREATE TABLE plantings (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    plot_id INT UNSIGNED NOT NULL,
    crop_name VARCHAR(150) NOT NULL,
    variety VARCHAR(150) DEFAULT NULL,
    planted_date DATE NOT NULL,
    expected_harvest_date DATE DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_planting_plot
        FOREIGN KEY (plot_id) REFERENCES plots(id)
        ON DELETE CASCADE,
    INDEX idx_planting_date (planted_date),
    INDEX idx_expected_harvest (expected_harvest_date)
) ENGINE=InnoDB;


-- 4. WATERING TASKS
CREATE TABLE tasks (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    plot_id INT UNSIGNED NOT NULL,
    task_date DATE NOT NULL,
    task_type ENUM('Water', 'Fertilize', 'Weed', 'Pest Control', 'Inspect', 'Other')
        DEFAULT NULL,
    done TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_watering_plot
        FOREIGN KEY (plot_id) REFERENCES plots(id)
        ON DELETE CASCADE,
    INDEX idx_task_date_done (task_date, done)
) ENGINE=InnoDB;


-- 5. HARVESTS
CREATE TABLE harvests (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    plot_id INT UNSIGNED NOT NULL,
    harvest_date DATE NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    notes VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_harvest_plot
        FOREIGN KEY (plot_id) REFERENCES plots(id)
        ON DELETE CASCADE,
    INDEX idx_harvest_date (harvest_date)
) ENGINE=InnoDB;


-- 6. SEEDS
CREATE TABLE seeds (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED DEFAULT NULL,
    seed_name VARCHAR(150) NOT NULL,
    crop_type ENUM('Rice') NOT NULL DEFAULT 'Rice',
    quantity_g DECIMAL(10,2) NOT NULL DEFAULT 0,
    threshold_g DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_seed_user (user_id)
) ENGINE=InnoDB;


-- 7. FINANCE TRANSACTIONS
CREATE TABLE finance_transactions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED DEFAULT NULL,
    plot_id INT UNSIGNED DEFAULT NULL,
    transaction_type ENUM('Expense', 'Income') NOT NULL,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    transaction_date DATE NOT NULL,
    notes VARCHAR(500) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_finance_plot
        FOREIGN KEY (plot_id) REFERENCES plots(id)
        ON DELETE SET NULL,
    INDEX idx_finance_date (transaction_date),
    INDEX idx_finance_type (transaction_type),
    INDEX idx_finance_user (user_id)
) ENGINE=InnoDB;


-- 8. INVENTORY ITEMS
CREATE TABLE inventory_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED DEFAULT NULL,
    item_name VARCHAR(150) NOT NULL,
    category ENUM('Rice Seeds', 'Fertilizers', 'Pesticides', 'Other Supplies') NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
    unit VARCHAR(30) NOT NULL DEFAULT 'kg',
    purchase_date DATE NOT NULL,
    threshold DECIMAL(10,2) NOT NULL DEFAULT 0,
    cost DECIMAL(12,2) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_purchase_date (purchase_date),
    INDEX idx_inventory_user (user_id)
) ENGINE=InnoDB;


-- 9. INVENTORY USAGE LOGS
CREATE TABLE inventory_usage_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    item_id INT UNSIGNED NOT NULL,
    quantity_used DECIMAL(10,2) NOT NULL,
    used_date DATE NOT NULL,
    plot_id INT UNSIGNED DEFAULT NULL,
    purpose VARCHAR(255) DEFAULT NULL,
    logged_by VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usage_item
        FOREIGN KEY (item_id) REFERENCES inventory_items(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_usage_plot
        FOREIGN KEY (plot_id) REFERENCES plots(id)
        ON DELETE SET NULL,
    INDEX idx_item_date (item_id, used_date)
) ENGINE=InnoDB;


-- 10. ACTIVITY LOGS
CREATE TABLE activity_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED DEFAULT NULL,
    username VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_log_created (created_at),
    INDEX idx_log_action (action)
) ENGINE=InnoDB;


-- ADMINISTRATOR STARTER ACCOUNT
-- Password: admin123

INSERT IGNORE INTO users
    (id, full_name, phone, username, password_hash, role, status)
VALUES
    (1, 'System Administrator', '09123456789', 'admin',
     '$2y$10$zoNQFRXSP6wNugkS082EAu/kb1V/jPE9G4AHtPUSGj7EVqy2G3uFa',
     'admin', 'active');
