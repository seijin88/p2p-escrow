"""Direct-mode fixtures for GenLayer contract tests (gltest, no network)."""

import os
import sys
from pathlib import Path

import pytest

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

from gltest.direct import VMContext, create_address, deploy_contract

CONTRACT_PATH = Path(__file__).resolve().parent.parent / "contracts" / "p2p_escrow_studio.py"


@pytest.fixture
def vm():
    ctx = VMContext()
    with ctx.activate():
        yield ctx


@pytest.fixture
def owner():
    return create_address("owner")


@pytest.fixture
def seller():
    return create_address("seller")


@pytest.fixture
def buyer():
    return create_address("buyer")


@pytest.fixture
def contract(vm, owner):
    vm.sender = owner
    vm.value = 0
    return deploy_contract(CONTRACT_PATH, vm)
