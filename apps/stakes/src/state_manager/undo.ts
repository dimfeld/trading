import { applyPatches } from 'immer';
import { StateHook, StateModification } from './types';
import { State, allStores } from './stores';

/**
 * UndoStateHook manages a global undo across multiple
 * stores of data. Generally there should just be one of these
 * per set of undo/redo buttons.
 */
export default class UndoStateHook implements StateHook {
  name = 'undo';
  steps: Array<StateModification<any>> = [];
  currentStep = 0;
  maxSteps: number;

  constructor(maxSteps: number) {
    this.maxSteps = maxSteps;
  }

  canUndo() {
    return this.currentStep > 0;
  }

  canRedo() {
    return this.currentStep < this.steps.length;
  }

  add(step: StateModification<any>) {
    if (this.currentStep !== this.steps.length) {
      // If we did some undos, then remove the state that we undid
      // since we're branching to a new state.
      this.steps = this.steps.slice(0, this.currentStep);
    }

    this.steps.push(step);

    if (this.currentStep === this.maxSteps) {
      // We're at the limit of undo steps, so remove the oldest one.
      // Since currentStep is already at the end we leave it alone.
      this.steps.shift();
    } else {
      this.currentStep++;
    }
  }

  undo(numSteps = 1) {
    let targetStep = Math.max(0, this.currentStep - numSteps);
    while (this.currentStep > targetStep) {
      this.currentStep--;
      this.applyOneUndo(this.steps[this.currentStep]);
    }
  }

  redo(numSteps = 1) {
    let targetStep = Math.min(this.steps.length, this.currentStep + numSteps);
    while (this.currentStep < targetStep) {
      this.applyOneRedo(this.steps[this.currentStep]);
      this.currentStep++;
    }
  }

  applyOneUndo(step: StateModification<any>) {
    let target = allStores.get(step.storeName);
    if (target) {
      target.update(
        (draft) => {
          applyPatches(draft, step.inversePatches);
        },
        { undo: true }
      );
    }
  }

  applyOneRedo(step: StateModification<any>) {
    let target = allStores.get(step.storeName);
    if (target) {
      target.update(
        (draft) => {
          applyPatches(draft, step.patches);
        },
        { undo: true }
      );
    }
  }
}
