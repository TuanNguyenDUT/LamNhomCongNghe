import 'package:material_ui/material_ui.dart';

import 'spotlight_search_overlay.dart';
import 'warm_pearl_tokens.dart';

/// Floating Bottom Liquid Glass Dock + Detached Spotlight Orb.
/// Strictly implements the Warm Pearl iOS 26 Liquid Glass 4-tab specification.
class FloatingBottomDock extends StatelessWidget {
  const FloatingBottomDock({
    super.key,
    required this.selectedIndex,
    required this.onTabSelected,
    this.pendingCount = 0,
  });

  final int selectedIndex;
  final ValueChanged<int> onTabSelected;
  final int pendingCount;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Row(
        children: [
          // 4-Tab Liquid Glass Dock Pill
          Expanded(
            child: Container(
              height: 62,
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: WarmPearlColors.dockBg,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: WarmPearlColors.glassBorderStrong,
                  width: 1,
                ),
                boxShadow: WarmPearlShadows.dock,
              ),
              child: Stack(
                children: [
                  // Sliding lens behind active tab
                  AnimatedAlign(
                    alignment: _calculateLensAlignment(selectedIndex),
                    duration: const Duration(milliseconds: 360),
                    curve: WarmPearlMotion.spring,
                    child: FractionallySizedBox(
                      widthFactor: 0.25,
                      heightFactor: 1.0,
                      child: Container(
                        decoration: BoxDecoration(
                          gradient: WarmPearlGradients.dockLens,
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                            color: WarmPearlColors.coralBorder,
                            width: 1,
                          ),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x24FF5A36),
                              blurRadius: 10,
                              offset: Offset(0, 3),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                  // 4 Tab buttons
                  Row(
                    children: [
                      _buildDockItem(
                        index: 0,
                        icon: Icons.feed_outlined,
                        activeIcon: Icons.feed_rounded,
                        label: 'Bảng tin',
                      ),
                      _buildDockItem(
                        index: 1,
                        icon: Icons.school_outlined,
                        activeIcon: Icons.school_rounded,
                        label: 'Học phần',
                      ),
                      _buildDockItem(
                        index: 2,
                        icon: Icons.check_box_outlined,
                        activeIcon: Icons.check_box_rounded,
                        label: 'Hạn & Nhắc',
                        badgeCount: pendingCount,
                      ),
                      _buildDockItem(
                        index: 3,
                        icon: Icons.person_outline_rounded,
                        activeIcon: Icons.person_rounded,
                        label: 'Hồ sơ',
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(width: 10),

          // Detached 62x62 Spotlight Glass Orb
          _SpotlightGlassOrb(
            onTap: () => openSpotlightSearch(context),
          ),
        ],
      ),
    );
  }

  Alignment _calculateLensAlignment(int index) {
    switch (index) {
      case 0:
        return const Alignment(-1.0, 0.0);
      case 1:
        return const Alignment(-0.333, 0.0);
      case 2:
        return const Alignment(0.333, 0.0);
      case 3:
      default:
        return const Alignment(1.0, 0.0);
    }
  }

  Widget _buildDockItem({
    required int index,
    required IconData icon,
    required IconData activeIcon,
    required String label,
    int badgeCount = 0,
  }) {
    final isActive = selectedIndex == index;

    return Expanded(
      child: GestureDetector(
        onTap: () => onTabSelected(index),
        behavior: HitTestBehavior.opaque,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  isActive ? activeIcon : icon,
                  size: 20,
                  color: isActive
                      ? WarmPearlColors.coralInk
                      : WarmPearlColors.inkMuted,
                ),
                const SizedBox(height: 3),
                Text(
                  label,
                  maxLines: 1,
                  style: TextStyle(
                    fontFamily: WarmPearlTypography.displayFont,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.1,
                    color: isActive
                        ? WarmPearlColors.coralInk
                        : WarmPearlColors.inkMuted,
                  ),
                ),
              ],
            ),
            if (badgeCount > 0)
              Positioned(
                top: 2,
                right: 6,
                child: Container(
                  constraints: const BoxConstraints(minWidth: 16),
                  height: 16,
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  decoration: BoxDecoration(
                    gradient: WarmPearlGradients.coralButton,
                    borderRadius: BorderRadius.circular(999),
                    boxShadow: const [
                      BoxShadow(
                        color: WarmPearlColors.coralGlow,
                        blurRadius: 6,
                        offset: Offset(0, 2),
                      ),
                    ],
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    badgeCount > 9 ? '9+' : '$badgeCount',
                    style: const TextStyle(
                      fontFamily: WarmPearlTypography.displayFont,
                      fontSize: 9.5,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      height: 1.1,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _SpotlightGlassOrb extends StatefulWidget {
  const _SpotlightGlassOrb({required this.onTap});

  final VoidCallback onTap;

  @override
  State<_SpotlightGlassOrb> createState() => _SpotlightGlassOrbState();
}

class _SpotlightGlassOrbState extends State<_SpotlightGlassOrb> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    return AnimatedScale(
      scale: _isPressed ? 0.90 : 1.0,
      duration: const Duration(milliseconds: 140),
      curve: WarmPearlMotion.spring,
      child: GestureDetector(
        onTapDown: (_) => setState(() => _isPressed = true),
        onTapUp: (_) => setState(() => _isPressed = false),
        onTapCancel: () => setState(() => _isPressed = false),
        onTap: widget.onTap,
        child: Container(
          width: 62,
          height: 62,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: WarmPearlColors.dockBg,
            border: Border.all(
              color: WarmPearlColors.glassBorderStrong,
              width: 1,
            ),
            boxShadow: WarmPearlShadows.dock,
          ),
          alignment: Alignment.center,
          child: const Icon(
            Icons.search_rounded,
            size: 24,
            color: WarmPearlColors.inkPrimary,
          ),
        ),
      ),
    );
  }
}
