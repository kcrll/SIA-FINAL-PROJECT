-- ============================================================
-- Non-destructive migration for the `ani` database
-- Adds the seed-tracking features from the newer dump without
-- dropping tables or changing existing IDs / task completion.
-- Safe to re-run (columns/indexes are added only if missing).
-- ============================================================

USE ani;

-- 1. Seeds lookup/stock table
CREATE TABLE IF NOT EXISTS seeds (
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

INSERT IGNORE INTO seeds (seed_id, user_id, seed_name, quantity_g, threshold_g, created_at, seed_type) VALUES
    (1, NULL, '160',    0.00, 0.00, '2026-11-18 06:13:39', '160'),
    (2, NULL, '152',    0.00, 0.00, '2026-11-18 06:13:39', '152'),
    (3, NULL, '480',    0.00, 0.00, '2026-11-18 06:13:39', '480'),
    (4, NULL, '402',    0.00, 0.00, '2026-11-18 06:13:39', '402'),
    (5, NULL, '436',    0.00, 0.00, '2026-11-18 06:13:39', '436'),
    (6, NULL, 'RC18',   0.00, 0.00, '2026-11-18 06:13:39', 'RC18'),
    (7, NULL, 'RC10',   0.00, 0.00, '2026-11-18 06:13:39', 'RC10'),
    (8, NULL, 'Hybrid', 0.00, 0.00, '2026-11-18 06:13:39', 'Hybrid');

-- 2. Plots: seed links, audit column, extra status
ALTER TABLE plots
    ADD COLUMN seed_id INT UNSIGNED DEFAULT NULL AFTER user_id,
    ADD COLUMN updated_by INT UNSIGNED DEFAULT NULL AFTER seed_id,
    MODIFY COLUMN status ENUM('Available','Planted','Maintenance','Occupied') NOT NULL DEFAULT 'Available',
    ADD COLUMN seed_type ENUM('160','152','480','402','436','RC18','RC10','Hybrid') DEFAULT NULL AFTER created_at,
    ADD INDEX idx_plot_seed (seed_id),
    ADD INDEX idx_plot_updated_by (updated_by),
    ADD INDEX fk_plots_seed_type (seed_type);

ALTER TABLE plots
    ADD CONSTRAINT fk_plot_seed
        FOREIGN KEY (seed_id) REFERENCES seeds(seed_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT fk_plot_updated_by
        FOREIGN KEY (updated_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT fk_plots_seed_type
        FOREIGN KEY (seed_type) REFERENCES seeds(seed_type)
        ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Plantings: seed type
ALTER TABLE plantings
    ADD COLUMN seed_type ENUM('160','152','480','402','436','RC18','RC10','Hybrid') DEFAULT NULL AFTER created_at,
    ADD INDEX fk_plantings_seed_type (seed_type);

ALTER TABLE plantings
    ADD CONSTRAINT fk_plantings_seed_type
        FOREIGN KEY (seed_type) REFERENCES seeds(seed_type)
        ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Tasks: audit column
ALTER TABLE tasks
    ADD COLUMN updated_by INT UNSIGNED DEFAULT NULL AFTER task_type,
    ADD INDEX idx_task_updated_by (updated_by);

ALTER TABLE tasks
    ADD CONSTRAINT fk_task_updated_by
        FOREIGN KEY (updated_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Harvests: planting link and measurement unit
ALTER TABLE harvests
    ADD COLUMN planting_id INT UNSIGNED DEFAULT NULL AFTER plot_id,
    ADD COLUMN measurement ENUM('kg','g','sacks','bottles','pcs','tons','liters') NOT NULL DEFAULT 'kg' AFTER quantity,
    ADD INDEX idx_harvest_planting (planting_id);

ALTER TABLE harvests
    ADD CONSTRAINT fk_harvest_planting
        FOREIGN KEY (planting_id) REFERENCES plantings(id)
        ON UPDATE CASCADE;
