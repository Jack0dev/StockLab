package com.stocklab.config;

import javax.net.SocketFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.io.IOException;
import java.net.InetAddress;
import java.net.Socket;
import java.security.cert.X509Certificate;

/**
 * Custom SSLSocketFactory tin tưởng tất cả chứng chỉ SSL.
 * Cần thiết vì Java JDK trên máy không tin tưởng chứng chỉ SSL
 * của Gmail SMTP server (lỗi PKIX certificate validation).
 * Chỉ dùng cho môi trường development.
 */
public class TrustAllSSLSocketFactory extends SSLSocketFactory {

    private final SSLSocketFactory delegate;

    public TrustAllSSLSocketFactory() {
        try {
            TrustManager[] trustAll = new TrustManager[]{
                new X509TrustManager() {
                    public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                    public void checkClientTrusted(X509Certificate[] c, String t) {}
                    public void checkServerTrusted(X509Certificate[] c, String t) {}
                }
            };
            SSLContext ctx = SSLContext.getInstance("TLS");
            ctx.init(null, trustAll, new java.security.SecureRandom());
            delegate = ctx.getSocketFactory();
        } catch (Exception e) {
            throw new RuntimeException("Failed to create TrustAllSSLSocketFactory", e);
        }
    }

    // Phương thức static bắt buộc để JavaMail có thể tạo instance
    public static SocketFactory getDefault() {
        return new TrustAllSSLSocketFactory();
    }

    @Override
    public String[] getDefaultCipherSuites() { return delegate.getDefaultCipherSuites(); }

    @Override
    public String[] getSupportedCipherSuites() { return delegate.getSupportedCipherSuites(); }

    @Override
    public Socket createSocket(Socket s, String host, int port, boolean autoClose) throws IOException {
        return delegate.createSocket(s, host, port, autoClose);
    }

    @Override
    public Socket createSocket(String host, int port) throws IOException {
        return delegate.createSocket(host, port);
    }

    @Override
    public Socket createSocket(String host, int port, InetAddress localHost, int localPort) throws IOException {
        return delegate.createSocket(host, port, localHost, localPort);
    }

    @Override
    public Socket createSocket(InetAddress host, int port) throws IOException {
        return delegate.createSocket(host, port);
    }

    @Override
    public Socket createSocket(InetAddress host, int port, InetAddress localHost, int localPort) throws IOException {
        return delegate.createSocket(host, port, localHost, localPort);
    }
}
