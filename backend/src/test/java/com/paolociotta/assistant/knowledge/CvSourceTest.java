package com.paolociotta.assistant.knowledge;

import com.paolociotta.assistant.config.SiteProperties;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class CvSourceTest {

    @TempDir
    Path dir;

    @Test
    void removesPhoneNumbersButKeepsYearsAndEmails() {
        String cv = """
                Phone: +39 333 1234567
                Mobile: 333-123-4567
                Email: someone@example.com
                Reply, Rome (2020-Present)
                University 2013-2018
                """;
        String out = CvSource.redactPhoneNumbers(cv);
        assertThat(out)
                .doesNotContain("1234567").doesNotContain("123-4567")
                .contains("[phone removed]")
                .contains("2020-Present").contains("2013-2018").contains("someone@example.com");
    }

    @Test
    void readsThePdfAndPicksUpChangesWithoutARestart() throws Exception {
        Path pdf = dir.resolve("cv.pdf");
        writePdf(pdf, "Senior Backend Engineer at Reply. Phone +39 333 1234567");
        CvSource source = new CvSource(new SiteProperties(pdf.toString(), "", ""));

        assertThat(source.text()).contains("Senior Backend Engineer").doesNotContain("1234567");

        writePdf(pdf, "Staff Engineer at a new company");
        Files.setLastModifiedTime(pdf, FileTime.from(Instant.now().plusSeconds(5)));
        assertThat(source.text()).contains("Staff Engineer").doesNotContain("Senior Backend Engineer");
    }

    @Test
    void noCvConfiguredMeansEmptyText() {
        assertThat(new CvSource(new SiteProperties("", "", "")).text()).isEmpty();
        assertThat(new CvSource(new SiteProperties(dir.resolve("missing.pdf").toString(), "", "")).text()).isEmpty();
    }

    private static void writePdf(Path path, String line) throws Exception {
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage();
            doc.addPage(page);
            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                cs.newLineAtOffset(50, 700);
                cs.showText(line);
                cs.endText();
            }
            doc.save(path.toFile());
        }
    }
}
