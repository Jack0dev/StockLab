package com.stocklab.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;

/**
 * One-time migration: chuyển đổi các giá trị status cũ (PENDING, PARTIAL, REJECTED...)
 * sang hệ thống trạng thái mới (ACTIVE, PARTIALLY_FILLED, CANCELLED...) trước khi
 * Hibernate cố thay đổi cấu trúc enum trong database.
 *
 * Bước 1: Mở rộng ENUM column để chấp nhận cả giá trị cũ + mới
 * Bước 2: UPDATE các giá trị cũ sang tương ứng mới
 * Bước 3: Thu hẹp ENUM column về chỉ còn giá trị mới
 *
 * Runner này chạy SAU khi DataSource đã sẵn sàng nhưng vì Hibernate DDL chạy
 * tại thời điểm EntityManagerFactory init (trước CommandLineRunner), ta phải
 * dùng một BeanFactoryPostProcessor hoặc chấp nhận lỗi DDL warning từ Hibernate
 * rồi fix bằng CommandLineRunner. Cách tốt nhất: dùng SQL trực tiếp.
 */
@Component
@Order(1)
public class OrderStatusMigration implements CommandLineRunner {

    @Autowired
    private DataSource dataSource;

    @Override
    public void run(String... args) throws Exception {
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {

            // Bước 1: Mở rộng enum để chấp nhận cả giá trị cũ + mới
            stmt.execute(
                "ALTER TABLE orders MODIFY COLUMN status " +
                "VARCHAR(30) NOT NULL"
            );

            // Bước 2: Migrate giá trị cũ → mới
            int r1 = stmt.executeUpdate("UPDATE orders SET status = 'ACTIVE' WHERE status = 'PENDING'");
            int r2 = stmt.executeUpdate("UPDATE orders SET status = 'PARTIALLY_FILLED' WHERE status = 'PARTIAL'");
            int r3 = stmt.executeUpdate("UPDATE orders SET status = 'CANCELLED' WHERE status = 'REJECTED'");

            // Bước 3: Thu hẹp lại thành ENUM mới
            stmt.execute(
                "ALTER TABLE orders MODIFY COLUMN status " +
                "ENUM('PENDING_TRIGGER','ACTIVE','PARTIALLY_FILLED','FILLED','CANCELLED','EXPIRED') NOT NULL"
            );

            int total = r1 + r2 + r3;
            if (total > 0) {
                System.out.println("[OrderStatusMigration] ✅ Migrated " + total + " orders " +
                    "(PENDING→ACTIVE: " + r1 + ", PARTIAL→PARTIALLY_FILLED: " + r2 + 
                    ", REJECTED→CANCELLED: " + r3 + ")");
            } else {
                System.out.println("[OrderStatusMigration] ✅ No old status values found - database is clean.");
            }

        } catch (Exception e) {
            // Nếu đã migrate trước đó thì sẽ không có lỗi gì
            // Nếu column đã là enum mới rồi thì bước 1 vẫn OK (VARCHAR luôn chấp nhận)
            System.out.println("[OrderStatusMigration] ⚠️ Migration note: " + e.getMessage());
        }
    }
}
