# Paolo Ciotta: profile

This is the complete, verified information about Paolo. The assistant may only use what is written here.

## Summary
- Senior Backend Engineer with 7+ years of experience designing, building and operating cloud-native microservices in large enterprise environments.
- Core stack: Java (8/17/21), Spring Boot, microservices, Apache Kafka, Hazelcast, PostgreSQL, Kubernetes/OpenShift.
- Owned the full lifecycle of ~50 production microservices supporting sales and post-sales workflows for postal and financial products on Poste Italiane's FEU platform, used daily by ~12,600 post offices across Italy.
- Experienced in event-driven architectures, distributed systems, observability, technical mentoring and cross-functional collaboration.
- Hands-on with AI-assisted software development, LLM integration and multi-agent systems, including designing and orchestrating agentic workflows.
- Location: Amsterdam, Netherlands. EU citizen (Italian). Relocating to Amsterdam.
- Looking for: Senior Backend and AI engineering roles in Amsterdam and the Netherlands.
- Languages: Italian (native), English (professional working proficiency).

## Work experience

### Senior Backend Engineer, Reply S.p.A., Rome, Italy (2020 - present)

**FEU (Unified Frontend) microservices ecosystem for Poste Italiane (2020 - present)**
- Designed, developed and maintained ~50 Spring Boot microservices supporting sales and post-sales workflows for postal and financial products.
- Led the migration from Java 8 to Java 17 and then to Java 21, eliminating 100% of high- and critical-severity StackRox security findings.
- Implemented asynchronous Kafka messaging to decouple microservices, so sales workflows are not blocked by synchronous external calls.
- Designed and implemented a distributed Hazelcast cache that reduced external service calls by about 25%.
- Led the evolution of the primary datastore from MySQL to Apache Ignite (for performance and scalability) and later to PostgreSQL (for reliability and long-term maintainability).
- Automated CI/CD pipelines with Jenkins and Helm-based OpenShift deployments, managing environment-specific configuration, scaling and resource allocation across dev and test environments.
- Improved code quality with JUnit and Mockito, reducing defects found in testing and pre-production by up to 80%.
- Implemented Prometheus metrics and Jaeger distributed tracing, bringing average production incident resolution within one business day.
- Integrated MinIO and Azure Storage for document persistence and archival.
- Partnered with business analysts to translate functional requirements into technical specifications, reducing rework.

**Multi-Agent Sales Funnel for Poste Italiane (2026 - present, early-stage initiative)**
- Contributes to the definition of an agentic sales funnel that introduces AI agents into FEU sales workflows for postal products.
- Contributes to the architectural analysis: agent responsibilities, orchestration approaches and integration points with the existing FEU ecosystem.
- Analyses multi-agent interaction patterns and use cases across the stages of the sales process.

**Multi-Agent AI Debugger, internal developer tool (2026 - present)**
- Designed and developed an internal agentic debugging tool with Java, Spring Boot and Spring AI. An orchestrator agent dynamically selects the specialised agents each debugging task needs.
- Tool-enabled agents inspect application logs, runtime errors, source code and technical documentation, using project specifications and error-handling rules as context.
- The workflow identifies likely root causes, generates code fixes aligned with project specifications and validates them by compiling the project before presenting the recommendation to developers.

**AI/ML Sentiment & Recommendation System, internal proof of concept (2024 - 2026)**
- Led a proof of concept to assess integrating AI/LLM capabilities into the company's future products.
- Built a Python backend using the OpenAI API to generate text embeddings for customer sentiment analysis.
- Designed customer segmentation by clustering behavioural and sentiment data across existing customers and prospects, with 2D dimensionality reduction for visualisation.
- Implemented a recommendation engine driven by cluster assignment and purchasing behaviour for cross-sell and up-sell.

### Backend Developer, DsTech, Rome, Italy (2018 - 2020)

**PosteDelivery, consulting assignment at Reply (2018 - 2020)**
- Developed backend microservices in Java 8 for purchasing and managing waybills and parcel shipments.
- Implemented REST APIs and SOAP services integrated with existing enterprise systems.
- Used Oracle databases, first via JDBC and later via Hibernate/JPA.
- Supported production troubleshooting and incident resolution in high-traffic environments.

**Additional consulting and training (2018 - 2020)**
- Consultant at Accenture: Android features for the BPER Bank mobile app and UI updates for Sicuritalia applications.
- Delivered technical training for new hires on Java SE/EE: OOP, Hibernate, Spring, REST APIs and SQL.

## Case studies (high level, no confidential client details)
1. **Kafka to unblock sales**: some steps of the sales workflows called external systems synchronously; when they were slow or down, the sale at the counter waited or failed. Paolo moved the steps that did not need an immediate answer to asynchronous Kafka messaging. Trade-offs: eventual consistency (a "pending" state), idempotent consumers and retry strategy, more components to monitor. Result: sales are no longer blocked by synchronous external calls.
2. **Distributed Hazelcast cache**: many service replicas requested the same data from external systems. A distributed cache shared across replicas cut external calls by about 25%. Trade-offs: data freshness vs. savings, memory sizing, one more component to operate.
3. **Datastore evolution MySQL -> Apache Ignite -> PostgreSQL**: Ignite first for performance and scalability, then PostgreSQL for reliability and long-term maintainability. Lesson: the fastest option is not automatically the right long-term one.
4. **Java 8 -> 17 -> 21 across ~50 services**: done in two steps to keep risk manageable; the improved JUnit/Mockito test suite made it safe. Result: 100% of high/critical StackRox findings eliminated.
5. **Observability**: Prometheus metrics and Jaeger distributed tracing let one request be followed across services. Result: average incident resolution within one business day.

## Technical skills
- Languages: Java 8/17/21, Python, SQL.
- Frameworks: Spring Boot, Spring MVC, Spring Data, Spring Security, Apache Camel.
- AI and agentic development: Spring AI, OpenAI API, Claude API, LLM integration, multi-agent systems, agent orchestration, embeddings.
- AI-assisted development tools: Claude Code, GitHub Copilot, OpenAI Codex.
- Messaging and caching: Apache Kafka, Hazelcast, Apache Ignite. Storage: MinIO, Azure Storage.
- DevOps and containers: Kubernetes, OpenShift, Docker, Helm, Jenkins.
- Databases: PostgreSQL, Oracle, MySQL. Persistence: Hibernate, JPA, JDBC.
- Observability: Prometheus, Grafana, Jaeger, Kibana.
- Testing: JUnit, Mockito, Postman, SoapUI.
- Version control: Git, GitLab, GitHub.
- Practices: microservices, event-driven architecture, distributed caching, REST and SOAP, Agile/Scrum.
- Earlier: Android development (at Accenture, 2018-2020).

## Education and certifications
- Bachelor's degree in Computer Science, University of Rome "Tor Vergata" (2013 - 2018). Thesis: natural language analysis of tweets using TF-IDF to measure non-verbal communication through emoji.
- Certifications: VMware Spring Professional (2020); MongoDB SI Associate (2023).
- Courses: Red Hat OpenShift Development DO288 (2022); MongoDB SI Architect (2023).

## Side projects
- **Fridge Manager** (github.com/Paolo994/fridge_manager): web app to manage fridge contents, expiry dates, shopping list and recipes, with AI food recognition from photos. Backend: Spring Boot 3.5, Java 21, Spring Security with JWT, JPA, H2 or PostgreSQL. Frontend: React 18, TypeScript, Vite, responsive. Deployed with Docker Compose (nginx, Spring Boot, PostgreSQL). AI features use the Claude API.
- **This website** (github.com/Paolo994/my-website): a pixel-art town explored on a motorbike, built with vanilla JavaScript and Canvas (no frameworks), road-graph pathfinding with Dijkstra, English and Italian. This assistant runs on a Spring Boot (Java 21) backend that calls Claude through the official Anthropic Java SDK, answering only from this profile, with prompt caching, structured output and per-visitor rate limiting.

## Personal
- Rides a grey Honda Hornet 750 (the bike on the website's map). Riding is how he resets.
- Enjoys solo travel: a backpack, a rough plan and room for the unexpected.
- Plays retro, adventure and strategy video games.
- Likes reading and writing, building software in his free time, and above all finding solutions to problems.

## Contact
- Email: paolociotta1@gmail.com
- LinkedIn: linkedin.com/in/paolo-ciotta
- GitHub: github.com/Paolo994
- CV: downloadable from the website (PDF, English).

## Not covered here (the assistant must not guess these)
Salary expectations, notice period, exact start date, visa or work-permit details beyond being an EU citizen, references, reasons for leaving, phone number, home address, age, family, health, political or religious views, and any confidential details about clients or employers. For these, suggest emailing Paolo.
