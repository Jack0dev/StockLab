package com.stocklab;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EntityScan(basePackages = "com.stocklab.domain.model")
@EnableJpaRepositories(basePackages = "com.stocklab.infrastructure.repository")
public class StocklabApplication {

    public static void main(String[] args) {
        SpringApplication.run(StocklabApplication.class, args);
    }
}
