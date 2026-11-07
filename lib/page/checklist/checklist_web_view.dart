import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:town_pass/util/checklist_config.dart';
import 'package:town_pass/util/tp_app_bar.dart';
import 'package:town_pass/util/tp_colors.dart';
import 'package:town_pass/util/tp_web_view.dart';
import 'package:url_launcher/url_launcher.dart';

/// Only hosts the standalone React application; all checklist UI lives on the web.
class ChecklistWebView extends StatefulWidget {
  const ChecklistWebView({super.key});

  @override
  State<ChecklistWebView> createState() => _ChecklistWebViewState();
}

class _ChecklistWebViewState extends State<ChecklistWebView> {
  InAppWebViewController? _controller;
  bool _canGoBack = false;
  bool _failed = false;

  Future<void> _updateHistory() async {
    final canGoBack = await _controller?.canGoBack() ?? false;
    if (mounted) setState(() => _canGoBack = canGoBack);
  }

  Future<void> _back() async {
    if (await _controller?.canGoBack() ?? false) {
      await _controller?.goBack();
      await _updateHistory();
    } else if (mounted) {
      Navigator.of(context).pop();
    }
  }

  Future<void> _openExternal(WebUri? webUri) async {
    final uri = Uri.tryParse(webUri?.toString() ?? '');
    if (uri == null ||
        uri.userInfo.isNotEmpty ||
        !const {'https', 'tel', 'mailto'}.contains(uri.scheme)) {
      return;
    }
    try {
      final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!opened && mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('無法開啟連結，請稍後再試。')));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('無法開啟連結，請稍後再試。')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final configured = ChecklistConfig.isAllowedUrl(ChecklistConfig.webUrl);
    final trusted = configured ? Uri.parse(ChecklistConfig.webUrl) : null;
    return PopScope(
      canPop: !_canGoBack,
      onPopInvokedWithResult: (didPop, _) async {
        if (!didPop) await _back();
      },
      child: Scaffold(
        appBar: TPAppBar(
          title: '辦事帶什麼',
          backgroundColor: TPColors.primary500,
          foregroundColor: TPColors.primary900,
          leading: IconButton(
            tooltip: '返回上一頁',
            onPressed: _back,
            icon: const Icon(Icons.arrow_back, size: 24),
          ),
        ),
        body: !configured
            ? const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text('辦事帶什麼服務尚未啟用，請稍後再試。'),
                ),
              )
            : _failed
            ? Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('目前無法載入服務，請檢查網路連線。'),
                    TextButton(
                      onPressed: () => setState(() => _failed = false),
                      child: const Text('重新載入'),
                    ),
                  ],
                ),
              )
            : TPInAppWebView(
                enableTownPassBridge: false,
                initialUrlRequest: URLRequest(
                  url: WebUri(ChecklistConfig.webUrl),
                ),
                initialSettings: InAppWebViewSettings(
                  useShouldOverrideUrlLoading: true,
                  supportMultipleWindows: true,
                  javaScriptCanOpenWindowsAutomatically: false,
                  mixedContentMode: MixedContentMode.MIXED_CONTENT_NEVER_ALLOW,
                  allowFileAccess: false,
                  allowContentAccess: false,
                  geolocationEnabled: false,
                  isInspectable: kDebugMode,
                ),
                onWebViewCreated: (controller) => _controller = controller,
                onUpdateVisitedHistory: (_, _, _) => _updateHistory(),
                onLoadStop: (_, _) => _updateHistory(),
                shouldOverrideUrlLoading: (_, action) async {
                  final uri = Uri.tryParse(
                    action.request.url?.toString() ?? '',
                  );
                  if (action.isForMainFrame &&
                      uri != null &&
                      ChecklistConfig.isSameOrigin(trusted!, uri)) {
                    return NavigationActionPolicy.ALLOW;
                  }
                  if (action.isForMainFrame) {
                    await _openExternal(action.request.url);
                  }
                  return NavigationActionPolicy.CANCEL;
                },
                onCreateWindow: (_, action) async {
                  await _openExternal(action.request.url);
                  return false;
                },
                onPermissionRequest: (_, request) async => PermissionResponse(
                  resources: request.resources,
                  action: PermissionResponseAction.DENY,
                ),
                onGeolocationPermissionsShowPrompt: (_, origin) async =>
                    GeolocationPermissionShowPromptResponse(
                      origin: origin,
                      allow: false,
                      retain: false,
                    ),
                onReceivedError: (_, request, _) {
                  if (request.isForMainFrame == true && mounted) {
                    setState(() => _failed = true);
                  }
                },
                onReceivedHttpError: (_, request, response) {
                  if (request.isForMainFrame == true &&
                      response.statusCode != null &&
                      response.statusCode! >= 400 &&
                      mounted) {
                    setState(() => _failed = true);
                  }
                },
              ),
      ),
    );
  }
}
