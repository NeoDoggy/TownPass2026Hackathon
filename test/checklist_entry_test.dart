import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';
import 'package:town_pass/page/city_service/widget/official_service_card/official_service_card_bottom_right.dart';
import 'package:town_pass/util/tp_route.dart';

void main() {
  testWidgets(
    'City Life opens the Checklist route without replacing other services',
    (tester) async {
      await tester.pumpWidget(
        GetMaterialApp(
          home: const Scaffold(
            body: SizedBox(width: 200, child: OfficialServiceCardBottomRight()),
          ),
          getPages: [
            GetPage(
              name: TPRoute.checklist,
              page: () => const Scaffold(body: Text('Checklist web host')),
            ),
          ],
        ),
      );
      expect(find.text('城市生活'), findsOneWidget);
      expect(find.text('辦事帶什麼'), findsOneWidget);
      await tester.tap(find.text('辦事帶什麼'));
      await tester.pumpAndSettle();
      expect(find.text('Checklist web host'), findsOneWidget);
      Get.reset();
    },
  );
}
