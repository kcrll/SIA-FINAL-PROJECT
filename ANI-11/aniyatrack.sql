
CREATE DATABASE IF NOT EXISTS ani
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE aniyatrack;

-- 1. USERS
CREATE TABLE users (
    user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) DEFAULT NULL,
    username VARCHAR(30) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. SEEDS
CREATE TABLE seeds (
    seed_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED DEFAULT NULL,
    seed_name VARCHAR(150) NOT NULL,
    quantity_g DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    threshold_g DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    seed_type ENUM('160','152','480','402','436','RC18','RC10','Hybrid') DEFAULT NULL,

    INDEX idx_seed_user (user_id),

    CONSTRAINT fk_seeds_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 3. PLOTS
CREATE TABLE plots (
    plot_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED DEFAULT NULL,
    seed_id INT UNSIGNED DEFAULT NULL,
    updated_by INT UNSIGNED DEFAULT NULL,
    name VARCHAR(100) NOT NULL,
    status ENUM('Available','Planted','Occupied','Maintenance')
        NOT NULL DEFAULT 'Available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    seed_type VARCHAR(100) DEFAULT NULL,

    UNIQUE KEY uq_plot_user_name (user_id, name),
    INDEX idx_plot_updated_by (updated_by),
    INDEX idx_plot_seed (seed_id),

    CONSTRAINT fk_plots_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE,

    CONSTRAINT fk_plot_seed
        FOREIGN KEY (seed_id) REFERENCES seeds(seed_id)
        ON DELETE SET NULL ON UPDATE CASCADE,

    CONSTRAINT fk_plot_updated_by
        FOREIGN KEY (updated_by) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 4. PLANTINGS
CREATE TABLE plantings (
    planting_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    plot_id INT UNSIGNED NOT NULL,
    variety VARCHAR(150) DEFAULT NULL,
    planted_date DATE NOT NULL,
    expected_harvest_date DATE DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_planting_date (planted_date),
    INDEX idx_expected_harvest (expected_harvest_date),

    CONSTRAINT fk_planting_plot
        FOREIGN KEY (plot_id) REFERENCES plots(plot_id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. WATERING TASKS
CREATE TABLE watering_tasks (
    task_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    plot_id INT UNSIGNED NOT NULL,
    task_date DATE NOT NULL,
    task_type ENUM('Water','Fertilize','Weed','Pest Control','Inspect','Other')
        NOT NULL DEFAULT 'Water',
    updated_by INT UNSIGNED DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_task_date_done (task_date),
    INDEX idx_task_updated_by (updated_by),

    CONSTRAINT fk_watering_plot
        FOREIGN KEY (plot_id) REFERENCES plots(plot_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_task_updated_by
        FOREIGN KEY (updated_by) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 6. HARVESTS
CREATE TABLE harvests (
    harvest_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    plot_id INT UNSIGNED NOT NULL,
    harvest_date DATE NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    measurement ENUM('kg','g','sacks','bottles','pcs','tons','liters')
        NOT NULL DEFAULT 'kg',
    unit VARCHAR(30) NOT NULL DEFAULT 'kg',
    notes VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_harvest_date (harvest_date),

    CONSTRAINT fk_harvest_plot
        FOREIGN KEY (plot_id) REFERENCES plots(plot_id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. INVENTORY ITEMS
CREATE TABLE inventory_items (
    item_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED DEFAULT NULL,
    item_name VARCHAR(150) NOT NULL,
    category ENUM('Rice Seeds','Fertilizers','Pesticides','Other Supplies')
        NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    unit VARCHAR(30) NOT NULL DEFAULT 'kg',
    purchase_date DATE NOT NULL,
    threshold DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    cost DECIMAL(12,2) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_category (category),
    INDEX idx_purchase_date (purchase_date),
    INDEX idx_inventory_user (user_id),

    CONSTRAINT fk_inventory_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 8. INVENTORY USAGE LOGS
CREATE TABLE inventory_usage_logs (
    usage_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    item_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED DEFAULT NULL,
    quantity_used DECIMAL(10,2) NOT NULL,
    used_date DATE NOT NULL,
    plot_id INT UNSIGNED DEFAULT NULL,
    purpose VARCHAR(255) DEFAULT NULL,
    logged_by VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_item_date (item_id, used_date),
    INDEX idx_usage_user (user_id),

    CONSTRAINT fk_usage_item
        FOREIGN KEY (item_id) REFERENCES inventory_items(item_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_usage_plot
        FOREIGN KEY (plot_id) REFERENCES plots(plot_id)
        ON DELETE SET NULL,

    CONSTRAINT fk_usage_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 9. FINANCE TRANSACTIONS
CREATE TABLE finance_transactions (
    transaction_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED DEFAULT NULL,
    plot_id INT UNSIGNED DEFAULT NULL,
    transaction_type ENUM('Expense','Income') NOT NULL,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    transaction_date DATE NOT NULL,
    notes VARCHAR(500) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_finance_date (transaction_date),
    INDEX idx_finance_type (transaction_type),
    INDEX idx_finance_user (user_id),

    CONSTRAINT fk_finance_plot
        FOREIGN KEY (plot_id) REFERENCES plots(plot_id)
        ON DELETE SET NULL,

    CONSTRAINT fk_finance_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 10. ACTIVITY LOGS
CREATE TABLE activity_logs (
    log_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED DEFAULT NULL,
    username VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_log_created (created_at),
    INDEX idx_log_action (action),

    CONSTRAINT fk_activity_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;
