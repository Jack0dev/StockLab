package com.stocklab.service;

import com.stocklab.model.Transaction;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class ReportExportService {

    public ByteArrayInputStream generateTransactionExcel(List<Transaction> transactions) throws IOException {
        String[] columns = {"ID Giao dịch", "Mã Cổ phiếu", "Loại", "Khối lượng", "Giá khớp (VND)", "Tổng số tiền (VND)", "Thời gian"};

        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Lịch sử giao dịch");

            // Trang trí tiêu đề Header (In đậm, nền mầu)
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.BLACK.getIndex());

            CellStyle headerCellStyle = workbook.createCellStyle();
            headerCellStyle.setFont(headerFont);
            headerCellStyle.setFillForegroundColor(IndexedColors.LIGHT_TURQUOISE.getIndex());
            headerCellStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerCellStyle.setAlignment(HorizontalAlignment.CENTER);

            Row headerRow = sheet.createRow(0);

            // Set Header names
            for (int col = 0; col < columns.length; col++) {
                Cell cell = headerRow.createCell(col);
                cell.setCellValue(columns[col]);
                cell.setCellStyle(headerCellStyle);
            }

            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

            // Đổ dữ liệu Data rows
            int rowIdx = 1;
            for (Transaction t : transactions) {
                Row row = sheet.createRow(rowIdx++);

                row.createCell(0).setCellValue(t.getId());
                row.createCell(1).setCellValue(t.getStock().getTicker());
                row.createCell(2).setCellValue(t.getType() != null ? t.getType().name() : "");
                row.createCell(3).setCellValue(t.getQuantity());
                row.createCell(4).setCellValue(t.getPrice() != null ? t.getPrice().doubleValue() : 0);
                row.createCell(5).setCellValue(t.getTotalAmount() != null ? t.getTotalAmount().doubleValue() : 0);
                
                Cell dateCell = row.createCell(6);
                dateCell.setCellValue(t.getCreatedAt() != null ? t.getCreatedAt().format(formatter) : "");
            }

            // Tự động căn chỉnh chiều dọc cột cho vừa văn bản
            for (int i = 0; i < columns.length; i++) {
                sheet.autoSizeColumn(i);
            }

            // Lưu vào output stream
            workbook.write(out);
            return new ByteArrayInputStream(out.toByteArray());
        }
    }
}
