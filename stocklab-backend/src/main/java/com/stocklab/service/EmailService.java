package com.stocklab.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private final JavaMailSender javaMailSender;

    @Value("${spring.mail.username}")
    private String senderEmail;

    public EmailService(JavaMailSender javaMailSender) {
        this.javaMailSender = javaMailSender;
    }

    public void sendEmail(String to, String subject, String body) {
        System.out.println("\n========== [EMAIL GỬI ĐI] ==========");
        System.out.println("From: StockLab <" + senderEmail + ">");
        System.out.println("To: " + to);
        System.out.println("Subject: " + subject);
        System.out.println("=====================================\n");

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom("StockLab <" + senderEmail + ">");
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            javaMailSender.send(message);
            System.out.println(">>> GỬI EMAIL THÀNH CÔNG tới: " + to);
        } catch (Exception e) {
            System.err.println(">>> LỖI GỬI EMAIL: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
