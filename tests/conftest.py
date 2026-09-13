"""
pytest configuration for P2PEscrow tests.
Uses genlayer-test direct mode — no Docker or network required.
"""

import os
import sys

# ── Windows-only workaround for genlayer-test 0.29.2 ──────────────────────────
# gltest.direct.loader._inject_message_to_fd0() writes the message context to a
# temp file, dup2()s it onto fd 0, then os.unlink()s it. That works on POSIX
# (unlinking an open file is legal) but fails on Windows with
# `PermissionError: [WinError 32] The process cannot access the file because it
# is being used by another process`, which makes every direct-mode test error
# out before the contract is even imported.
#
# We make os.unlink tolerant of that specific error for the duration of the
# call. The leaked temp file is a few hundred bytes in %TEMP% and is cleaned up
# by the OS; nothing else in the test run depends on it. CI (Linux) is
# unaffected — this block only runs on win32.
if sys.platform == "win32":
    from gltest.direct import loader as _gltest_loader

    _original_inject = _gltest_loader._inject_message_to_fd0

    def _inject_message_to_fd0_win_safe(vm):
        real_unlink = os.unlink

        def _tolerant_unlink(path, *args, **kwargs):
            try:
                real_unlink(path, *args, **kwargs)
            except PermissionError:
                pass

        os.unlink = _tolerant_unlink
        try:
            return _original_inject(vm)
        finally:
            os.unlink = real_unlink

    _gltest_loader._inject_message_to_fd0 = _inject_message_to_fd0_win_safe
