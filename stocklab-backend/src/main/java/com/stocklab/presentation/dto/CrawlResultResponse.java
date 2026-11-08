package com.stocklab.presentation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class CrawlResultResponse {
    private int sourcesProcessed;
    private int newArticles;
    private int duplicatesSkipped;
    private long totalArticlesInDb;
    private long durationMs;
    private LocalDateTime lastCrawlTime;
}
