package com.stocklab.service.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.Document;
import org.springframework.ai.reader.ExtractedTextFormatter;
import org.springframework.ai.reader.pdf.PagePdfDocumentReader;
import org.springframework.ai.reader.pdf.config.PdfDocumentReaderConfig;
import org.springframework.ai.transformer.splitter.TokenTextSplitter;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.ByteArrayResource;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class RagTrainingService {

    private final VectorStore vectorStore;

    public int trainDocument(MultipartFile file) {
        log.info("[RagTraining] Received MultipartFile: {}", file.getOriginalFilename());
        try {
            Resource resource = new ByteArrayResource(file.getBytes());
            return trainDocument(resource, file.getOriginalFilename());
        } catch (Exception e) {
            log.error("[RagTraining] Error reading MultipartFile", e);
            throw new RuntimeException("Lỗi đọc file: " + e.getMessage());
        }
    }

    public int trainDocument(Resource resource, String fileName) {
        if (fileName == null) fileName = "unknown";
        log.info("[RagTraining] Processing resource: {}", fileName);
        try {
            List<Document> splitDocuments;

            if (fileName.toLowerCase().endsWith(".pdf")) {
                splitDocuments = processPdf(resource, fileName);
            } else if (fileName.toLowerCase().endsWith(".txt") || fileName.toLowerCase().endsWith(".md")) {
                splitDocuments = processText(resource, fileName);
            } else {
                throw new IllegalArgumentException("Unsupported file type: " + fileName);
            }

            log.info("[RagTraining] Adding {} chunks to VectorStore...", splitDocuments.size());
            vectorStore.add(splitDocuments);

            // Persist if it's SimpleVectorStore
            if (vectorStore instanceof SimpleVectorStore simpleStore) {
                simpleStore.save(new File("local-vector-store.json"));
            }

            return splitDocuments.size();
        } catch (Exception e) {
            log.error("[RagTraining] Error processing file", e);
            throw new RuntimeException("Lỗi xử lý file: " + e.getMessage());
        }
    }

    private List<Document> processPdf(Resource resource, String fileName) throws IOException {
        Resource pdfResource = new ByteArrayResource(resource.getContentAsByteArray()) {
            @Override
            public String getFilename() {
                return fileName;
            }
        };

        PdfDocumentReaderConfig config = PdfDocumentReaderConfig.builder()
                .withPageExtractedTextFormatter(ExtractedTextFormatter.builder()
                        .withNumberOfBottomTextLinesToDelete(0)
                        .withNumberOfTopPagesToSkipBeforeDelete(0)
                        .build())
                .withPagesPerDocument(1)
                .build();

        PagePdfDocumentReader pdfReader = new PagePdfDocumentReader(resource, config);
        TokenTextSplitter textSplitter = new TokenTextSplitter(500, 100, 5, 10000, true);
        return textSplitter.apply(pdfReader.get());
    }

    private List<Document> processText(Resource resource, String fileName) throws IOException {
        String content = new String(resource.getContentAsByteArray(), StandardCharsets.UTF_8);
        Document document = new Document(content, Map.of("source", fileName));
        TokenTextSplitter textSplitter = new TokenTextSplitter(500, 100, 5, 10000, true);
        return textSplitter.apply(List.of(document));
    }
}
