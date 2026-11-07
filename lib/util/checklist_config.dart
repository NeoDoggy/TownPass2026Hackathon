import 'package:flutter/foundation.dart';

abstract final class ChecklistConfig {
  static const webUrl = String.fromEnvironment('CHECKLIST_WEB_URL');
  static const allowLocalHttp = bool.fromEnvironment(
    'CHECKLIST_ALLOW_LOCAL_HTTP',
  );

  static bool isAllowedUrl(String value, {bool? debug, bool? allowHttp}) {
    final uri = Uri.tryParse(value);
    if (uri == null ||
        !uri.hasAuthority ||
        uri.userInfo.isNotEmpty ||
        uri.query.isNotEmpty ||
        uri.fragment.isNotEmpty) {
      return false;
    }
    if (uri.scheme == 'https') return true;
    return (debug ?? kDebugMode) &&
        (allowHttp ?? allowLocalHttp) &&
        uri.scheme == 'http' &&
        const {'localhost', '127.0.0.1', '10.0.2.2'}.contains(uri.host);
  }

  static bool isSameOrigin(Uri trusted, Uri candidate) =>
      candidate.userInfo.isEmpty &&
      trusted.scheme == candidate.scheme &&
      trusted.host == candidate.host &&
      trusted.port == candidate.port;
}
