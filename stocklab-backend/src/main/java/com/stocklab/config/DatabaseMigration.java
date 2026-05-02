package com.stocklab.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class DatabaseMigration implements CommandLineRunner {
    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) {
        try {
            jdbcTemplate.execute("ALTER TABLE orders MODIFY status VARCHAR(50)");
            jdbcTemplate.execute("ALTER TABLE orders MODIFY order_type VARCHAR(50)");
            jdbcTemplate.execute("ALTER TABLE orders MODIFY time_in_force VARCHAR(50)");
            System.out.println("✅ Fixed ENUM columns in orders table to VARCHAR(50)!");
        } catch (Exception e) {
            System.err.println("DatabaseMigration error: " + e.getMessage());
        }
    }
}
