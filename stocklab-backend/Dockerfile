# ============================================
# Stage 1: Build with Maven
# ============================================
FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /app

# Cache Maven dependencies first
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 \
    apk add --no-cache maven && \
    mvn dependency:go-offline -B

# Copy source and build
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 \
    mvn clean package -DskipTests -B

# ============================================
# Stage 2: Run with lightweight JRE
# ============================================
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Security: run as non-root user
RUN addgroup -S stocklab && adduser -S stocklab -G stocklab

# Copy the built JAR
COPY --from=builder /app/target/*.jar app.jar

# Set ownership
RUN chown stocklab:stocklab app.jar

USER stocklab

# Render/Railway injects PORT env var
EXPOSE ${PORT:-8080}

# JVM tuning for container environments (optimized for Render Free: 512MB RAM)
ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-XX:+UseSerialGC", \
  "-Xss256k", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-Dspring.profiles.active=${SPRING_PROFILE:-default}", \
  "-jar", "app.jar"]
