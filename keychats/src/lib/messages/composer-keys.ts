export type ComposerKeyInput = {
  key: string
  shiftKey: boolean
  isComposing: boolean
}

export function shouldSubmitComposerKey(input: ComposerKeyInput) {
  return input.key === 'Enter' && !input.shiftKey && !input.isComposing
}
