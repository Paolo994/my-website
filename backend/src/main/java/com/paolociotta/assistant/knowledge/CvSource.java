package com.paolociotta.assistant.knowledge;

import com.paolociotta.assistant.config.SiteProperties;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The text of the CV PDF, so the assistant always answers from the latest CV.
 * The file is re-read whenever it changes on disk: replace the PDF and the next question already uses it.
 * Phone numbers are removed before anything reaches the model.
 */
@Component
public class CvSource {

    private static final Logger log = LoggerFactory.getLogger(CvSource.class);

    /** Digits with optional +, spaces, dots, dashes or brackets, on one line. */
    private static final Pattern PHONE_LIKE = Pattern.compile("\\+?\\d[\\d \\t().-]{7,}\\d");

    private final Path path;
    private volatile String text = "";
    private volatile FileTime loadedAt;

    public CvSource(SiteProperties site) {
        this.path = site.cvPath() == null || site.cvPath().isBlank() ? null : Path.of(site.cvPath());
    }

    /** Current CV text, or "" when no CV is configured or readable. */
    public String text() {
        if (path == null) {
            return "";
        }
        try {
            FileTime modified = Files.getLastModifiedTime(path);
            if (!modified.equals(loadedAt)) {
                reload(modified);
            }
        } catch (IOException e) {
            if (loadedAt != null) {
                log.warn("CV no longer readable at {}", path);
                loadedAt = null;
                text = "";
            }
        }
        return text;
    }

    private synchronized void reload(FileTime modified) throws IOException {
        if (modified.equals(loadedAt)) {
            return;
        }
        try (PDDocument doc = Loader.loadPDF(path.toFile())) {
            text = redactPhoneNumbers(new PDFTextStripper().getText(doc)).strip();
            loadedAt = modified;
            log.info("CV loaded from {} ({} characters)", path, text.length());
        }
    }

    /** Replaces anything that looks like a phone number (9+ digits); years such as "2013-2018" are kept. */
    static String redactPhoneNumbers(String s) {
        Matcher m = PHONE_LIKE.matcher(s);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            long digits = m.group().chars().filter(Character::isDigit).count();
            m.appendReplacement(out, digits >= 9 ? "[phone removed]" : Matcher.quoteReplacement(m.group()));
        }
        m.appendTail(out);
        return out.toString();
    }
}
