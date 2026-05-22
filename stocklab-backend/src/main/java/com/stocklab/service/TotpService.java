package com.stocklab.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.warrenstrange.googleauth.GoogleAuthenticator;
import com.warrenstrange.googleauth.GoogleAuthenticatorKey;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Service
@Slf4j
public class TotpService {

    private static final String ISSUER = "StockLab";
    private final GoogleAuthenticator googleAuthenticator = new GoogleAuthenticator();

    /**
     * Tạo secret key mới cho user
     */
    public String generateSecret() {
        GoogleAuthenticatorKey key = googleAuthenticator.createCredentials();
        return key.getKey();
    }

    /**
     * Tạo otpauth:// URL cho QR code
     */
    public String getOtpAuthUrl(String username, String secret) {
        return "otpauth://totp/" + URLEncoder.encode(ISSUER + ":" + username, StandardCharsets.UTF_8)
                + "?secret=" + secret
                + "&issuer=" + URLEncoder.encode(ISSUER, StandardCharsets.UTF_8)
                + "&algorithm=SHA1"
                + "&digits=6"
                + "&period=30";
    }

    /**
     * Tạo QR code dạng Base64 PNG
     */
    public String generateQrCodeBase64(String username, String secret) {
        String otpAuthUrl = getOtpAuthUrl(username, secret);
        try {
            QRCodeWriter qrCodeWriter = new QRCodeWriter();
            BitMatrix bitMatrix = qrCodeWriter.encode(otpAuthUrl, BarcodeFormat.QR_CODE, 300, 300);

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(bitMatrix, "PNG", outputStream);

            return "data:image/png;base64," + Base64.getEncoder().encodeToString(outputStream.toByteArray());
        } catch (WriterException | IOException e) {
            log.error("Lỗi tạo QR code: {}", e.getMessage());
            throw new RuntimeException("Không thể tạo mã QR");
        }
    }

    /**
     * Xác thực mã TOTP từ Google Authenticator
     */
    public boolean verifyCode(String secret, int code) {
        return googleAuthenticator.authorize(secret, code);
    }
}
