package com.stocklab;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class StocklabApplication {

    public static void main(String[] args) {
        SpringApplication.run(StocklabApplication.class, args);
    }
}
