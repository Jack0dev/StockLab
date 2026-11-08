package com.stocklab.presentation.controller;

import com.stocklab.presentation.dto.ApiResponse;
import com.stocklab.presentation.dto.WatchlistResponse;
import com.stocklab.service.WatchlistService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/watchlist")
@RequiredArgsConstructor
public class WatchlistController {

    private final WatchlistService watchlistService;

    @PostMapping("/{ticker}")
    public ResponseEntity<ApiResponse<WatchlistResponse>> addStock(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable String ticker) {

        ApiResponse<WatchlistResponse> response = watchlistService.addStock(
                userDetails.getUsername(), ticker);
        return response.isSuccess()
                ? ResponseEntity.ok(response)
                : ResponseEntity.badRequest().body(response);
    }

    @DeleteMapping("/{ticker}")
    public ResponseEntity<ApiResponse<String>> removeStock(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable String ticker) {

        ApiResponse<String> response = watchlistService.removeStock(
                userDetails.getUsername(), ticker);
        return response.isSuccess()
                ? ResponseEntity.ok(response)
                : ResponseEntity.badRequest().body(response);
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<WatchlistResponse>>> getWatchlist(
            @AuthenticationPrincipal UserDetails userDetails) {

        ApiResponse<List<WatchlistResponse>> response = watchlistService.getWatchlist(
                userDetails.getUsername());
        return response.isSuccess()
                ? ResponseEntity.ok(response)
                : ResponseEntity.badRequest().body(response);
    }

    @GetMapping("/check/{ticker}")
    public ResponseEntity<ApiResponse<Boolean>> isWatched(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable String ticker) {

        ApiResponse<Boolean> response = watchlistService.isWatched(
                userDetails.getUsername(), ticker);
        return response.isSuccess()
                ? ResponseEntity.ok(response)
                : ResponseEntity.badRequest().body(response);
    }
}
