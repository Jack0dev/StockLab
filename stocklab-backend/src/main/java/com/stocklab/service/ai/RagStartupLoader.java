package com.stocklab.service.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

import java.io.File;

@Component
@RequiredArgsConstructor
@Slf4j
public class RagStartupLoader implements CommandLineRunner {

    private final RagTrainingService ragTrainingService;

    @Override
    public void run(String... args) {
        log.info("[RagStartupLoader] Checking for internal documents to load...");

        // If local-vector-store.json exists, we assume documents were already loaded
        File vectorStoreFile = new File("local-vector-store.json");
        if (vectorStoreFile.exists()) {
            log.info("[RagStartupLoader] local-vector-store.json exists. Skipping auto-load to save time. Delete it if you want to re-index documents.");
            return;
        }

        try {
            PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
            Resource[] resources = resolver.getResources("classpath:docs/*.*");

            if (resources.length == 0) {
                log.info("[RagStartupLoader] No internal documents found in classpath:docs/");
                return;
            }

            int totalChunks = 0;
            for (Resource resource : resources) {
                String filename = resource.getFilename();
                if (filename != null && (filename.endsWith(".pdf") || filename.endsWith(".txt") || filename.endsWith(".md"))) {
                    int chunks = ragTrainingService.trainDocument(resource, filename);
                    totalChunks += chunks;
                    log.info("[RagStartupLoader] Loaded {} chunks from {}", chunks, filename);
                }
            }
            log.info("[RagStartupLoader] Successfully auto-loaded {} chunks from {} internal documents.", totalChunks, resources.length);

        } catch (Exception e) {
            log.error("[RagStartupLoader] Failed to auto-load documents", e);
        }
    }
}
