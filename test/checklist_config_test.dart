import 'package:flutter_test/flutter_test.dart';
import 'package:town_pass/util/checklist_config.dart';

void main() {
  test(
    'Checklist URL requires HTTPS without credentials or personal parameters',
    () {
      expect(
        ChecklistConfig.isAllowedUrl('https://checklist.example.org'),
        isTrue,
      );
      for (final url in [
        '',
        'javascript:alert(1)',
        'file:///tmp/index.html',
        'https://user:secret@example.org',
        'https://example.org?token=secret',
        'http://example.org',
      ]) {
        expect(ChecklistConfig.isAllowedUrl(url), isFalse, reason: url);
      }
      expect(
        ChecklistConfig.isAllowedUrl(
          'http://10.0.2.2:5173',
          debug: true,
          allowHttp: true,
        ),
        isTrue,
      );
      expect(
        ChecklistConfig.isAllowedUrl(
          'http://10.0.2.2:5173',
          debug: false,
          allowHttp: true,
        ),
        isFalse,
      );
      expect(
        ChecklistConfig.isAllowedUrl(
          'http://10.0.2.2:5173',
          debug: true,
          allowHttp: false,
        ),
        isFalse,
      );
    },
  );
  test('navigation checks scheme, host and port exactly', () {
    final trusted = Uri.parse('https://checklist.example.org');
    expect(
      ChecklistConfig.isSameOrigin(
        trusted,
        Uri.parse('https://checklist.example.org/services/seal-certificate'),
      ),
      isTrue,
    );
    for (final url in [
      'https://checklist.example.org.evil.test',
      'https://checklist.example.org:444',
      'http://checklist.example.org',
      'https://a@checklist.example.org',
    ]) {
      expect(ChecklistConfig.isSameOrigin(trusted, Uri.parse(url)), isFalse);
    }
  });
}
