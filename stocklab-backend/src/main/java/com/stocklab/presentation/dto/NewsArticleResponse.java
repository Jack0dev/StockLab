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
public class NewsArticleResponse {
    private Long id;
    private String title;
    private String link;
    private String description;
    private String thumbnailUrl;
    private String source;
    private String relatedTickers;
    private LocalDateTime publishedAt;
    private LocalDateTime createdAt;
}
