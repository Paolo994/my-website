# One container serves both the static site and the assistant API.
#   docker build -t paolo-site .
#   docker run -p 8787:8787 -e ANTHROPIC_API_KEY=sk-ant-... paolo-site

FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY backend/pom.xml .
RUN mvn -q -B dependency:go-offline
COPY backend/src ./src
RUN mvn -q -B package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 1001 app
COPY --from=build /src/target/site-assistant-1.0.0.jar app.jar
COPY index.html privacy.html /app/site/
COPY css /app/site/css
COPY js /app/site/js
COPY assets /app/site/assets
ENV SITE_DIR=file:/app/site/
# The CV is served for download and read by the assistant; docker-compose mounts the real file here.
ENV CV_PATH=/app/site/assets/cv/Paolo_Ciotta_CV_EN.pdf
USER app
EXPOSE 8787
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
