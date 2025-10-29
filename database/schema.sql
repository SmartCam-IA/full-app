-- SmartCam Images Analysis Database Schema
-- MariaDB / MySQL

-- Table for storing camera information
CREATE TABLE IF NOT EXISTS camera (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip VARCHAR(45) NOT NULL,
    port INT DEFAULT 554,
    path VARCHAR(255) DEFAULT '/live0',
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    last_connexion DATETIME,
    status ENUM('active', 'inactive', 'maintenance', 'error') DEFAULT 'inactive',
    model VARCHAR(255),
    fk_position INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_camera_ip (ip),
    INDEX idx_camera_position (fk_position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table for storing position/location information
CREATE TABLE IF NOT EXISTS `position` (
    id INT AUTO_INCREMENT PRIMARY KEY,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    label VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table for storing analysis configurations
CREATE TABLE IF NOT EXISTS analyse (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    type_analyse ENUM('Police', 'Ambulance', 'Pompier') NOT NULL,
    nbr_positive_necessary INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    api_endpoint VARCHAR(500),
    detection_threshold FLOAT DEFAULT 0.5,
    image_extraction_interval INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table for storing captured images
CREATE TABLE IF NOT EXISTS image (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATETIME NOT NULL,
    uri VARCHAR(500) NOT NULL,
    fk_camera INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fk_camera) REFERENCES camera(id) ON DELETE CASCADE,
    INDEX idx_image_date (date),
    INDEX idx_image_camera (fk_camera)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table for storing analysis results
CREATE TABLE IF NOT EXISTS resultat_analyse (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fk_image INT NOT NULL,
    fk_analyse INT NOT NULL,
    result ENUM('positive', 'negative', 'uncertain') NOT NULL,
    confidence FLOAT,
    severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    human_verification BOOLEAN DEFAULT FALSE,
    human_rejected BOOLEAN DEFAULT FALSE,
    is_resolved BOOLEAN DEFAULT FALSE,
    details TEXT,
    date DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (fk_image) REFERENCES image(id) ON DELETE CASCADE,
    FOREIGN KEY (fk_analyse) REFERENCES analyse(id) ON DELETE CASCADE,
    INDEX idx_result_image (fk_image),
    INDEX idx_result_analyse (fk_analyse),
    INDEX idx_result_date (date),
    INDEX idx_result_status (is_resolved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add foreign key constraint for position in camera table
ALTER TABLE camera 
ADD CONSTRAINT fk_camera_position 
FOREIGN KEY (fk_position) REFERENCES `position`(id) ON DELETE RESTRICT;

-- Insert default analysis types
INSERT INTO analyse (name, type_analyse, nbr_positive_necessary, api_endpoint, detection_threshold, image_extraction_interval) 
VALUES 
    ('Détection Incendie', 'Pompier', 2, 'https://router.huggingface.co/hf-inference/models/EdBianchi/vit-fire-detection', 0.5, 10)
ON DUPLICATE KEY UPDATE name=name;
