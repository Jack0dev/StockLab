package com.stocklab.repository;

import com.stocklab.model.Order;
import com.stocklab.model.OrderSide;
import com.stocklab.model.OrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    // Lệnh của 1 user (pagination)
    Page<Order> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    // Lệnh của 1 user theo status
    Page<Order> findByUserIdAndStatusOrderByCreatedAtDesc(Long userId, OrderStatus status, Pageable pageable);

    // Tất cả lệnh PENDING/PARTIAL cho 1 cổ phiếu (cho Matching Engine)
    List<Order> findByStockIdAndStatusOrderByCreatedAtAsc(Long stockId, OrderStatus status);

    // Lệnh BUY đang chờ khớp — sắp xếp giá giảm (giá cao nhất lên đầu), cùng giá thì FIFO
    List<Order> findByStockIdAndSideAndStatusOrderByPriceDescCreatedAtAsc(
            Long stockId, OrderSide side, OrderStatus status);

    // Lệnh SELL đang chờ khớp — sắp xếp giá tăng (giá thấp nhất lên đầu), cùng giá thì FIFO
    List<Order> findByStockIdAndSideAndStatusOrderByPriceAscCreatedAtAsc(
            Long stockId, OrderSide side, OrderStatus status);

    // Lệnh BUY PENDING+PARTIAL — cho Matching Engine
    List<Order> findByStockIdAndSideAndStatusInOrderByPriceDescCreatedAtAsc(
            Long stockId, OrderSide side, List<OrderStatus> statuses);

    // Lệnh SELL PENDING+PARTIAL — cho Matching Engine
    List<Order> findByStockIdAndSideAndStatusInOrderByPriceAscCreatedAtAsc(
            Long stockId, OrderSide side, List<OrderStatus> statuses);

    // Đếm lệnh PENDING cho 1 stock (cho order book)
    List<Order> findByStockIdAndSideAndStatusIn(Long stockId, OrderSide side, List<OrderStatus> statuses);

    // Lấy danh sách stock IDs có lệnh active (cho MatchingScheduler)
    @Query("SELECT DISTINCT o.stock.id FROM Order o WHERE o.status IN :statuses")
    List<Long> findDistinctStockIdsByStatusIn(@Param("statuses") List<OrderStatus> statuses);

    // Dành cho Admin: Lấy toàn bộ lệnh hệ thống
    Page<Order> findAllByOrderByCreatedAtDesc(Pageable pageable);

    // Dành cho Admin: Lấy toàn bộ lệnh hệ thống theo trạng thái
    Page<Order> findByStatusOrderByCreatedAtDesc(OrderStatus status, Pageable pageable);

    // Cho TriggerEngine: lấy tất cả lệnh PENDING_TRIGGER
    List<Order> findByStatus(OrderStatus status);

    // Cho OCO: lấy tất cả lệnh cùng group
    List<Order> findByOcoGroupId(String ocoGroupId);
}
