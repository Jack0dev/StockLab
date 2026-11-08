package com.stocklab.presentation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class CustomPortfolioDTO {
    private Long id;
    private String name;
    private String description;
    private Integer stockCount;
    private List<String> tickers;
    private LocalDateTime createdAt;
}
