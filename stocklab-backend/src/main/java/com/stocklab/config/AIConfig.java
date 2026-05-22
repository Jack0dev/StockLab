package com.stocklab.config;

import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.File;

@Configuration
public class AIConfig {

    @Bean
    public VectorStore vectorStore(EmbeddingModel embeddingModel) {
        SimpleVectorStore store = SimpleVectorStore.builder(embeddingModel).build();
        // Load existing vectors if file exists to persist data across restarts
        File vectorStoreFile = new File("local-vector-store.json");
        if (vectorStoreFile.exists()) {
            store.load(vectorStoreFile);
        }
        return store;
    }
}
