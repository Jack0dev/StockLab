package com.stocklab.repository;

import com.stocklab.model.WalletTransaction;
import com.stocklab.model.WalletTransactionType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface WalletTransactionRepository extends JpaRepository<WalletTransaction, Long> {
    java.util.Optional<WalletTransaction> findByTransactionCode(String transactionCode);
    Page<WalletTransaction> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
    Page<WalletTransaction> findByUserIdAndTypeOrderByCreatedAtDesc(Long userId, WalletTransactionType type, Pageable pageable);
    java.util.List<WalletTransaction> findAllByStatusAndCreatedAtBefore(com.stocklab.model.WalletTransactionStatus status, java.time.LocalDateTime date);
}
