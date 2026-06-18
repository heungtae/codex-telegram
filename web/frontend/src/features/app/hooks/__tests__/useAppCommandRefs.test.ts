import test from "node:test";
import assert from "node:assert/strict";

import { bindAppCommandRefs, createAppCommandRefs } from "../useAppCommandRefs";

test("createAppCommandRefs initializes command refs to null", () => {
  const refs = createAppCommandRefs();

  assert.equal(refs.sendMessage.current, null);
  assert.equal(refs.startThread.current, null);
  assert.equal(refs.closeThreadTab.current, null);
  assert.equal(refs.viewThread.current, null);
  assert.equal(refs.selectProject.current, null);
  assert.equal(refs.focusComposer.current, null);
  assert.equal(refs.setInputForActiveThread.current, null);
});

test("bindAppCommandRefs updates each command ref current value", () => {
  const refs = createAppCommandRefs();
  const commands = {
    sendMessage: async () => {},
    startThread: async () => {},
    closeThreadTab: () => {},
    viewThread: async () => {},
    selectProject: async () => {},
    focusComposer: () => {},
    setInputForActiveThread: () => {},
  };

  bindAppCommandRefs(refs, commands);

  assert.equal(refs.sendMessage.current, commands.sendMessage);
  assert.equal(refs.startThread.current, commands.startThread);
  assert.equal(refs.closeThreadTab.current, commands.closeThreadTab);
  assert.equal(refs.viewThread.current, commands.viewThread);
  assert.equal(refs.selectProject.current, commands.selectProject);
  assert.equal(refs.focusComposer.current, commands.focusComposer);
  assert.equal(refs.setInputForActiveThread.current, commands.setInputForActiveThread);
});
