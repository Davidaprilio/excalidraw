import { Footer } from "@excalidraw/excalidraw/index";
import React from "react";

import { isExcalidrawPlusSignedUser } from "../app_constants";

import { CommentIcon } from "./comments/CommentParts";
import { useComments } from "./comments/CommentsContext";
import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";
import { EncryptedIcon } from "./EncryptedIcon";

const IS_SELF_HOSTED = import.meta.env.VITE_APP_SELF_HOSTED === "true";

/** Next to undo/redo: toggles "click on the canvas to add a comment" */
const AddCommentButton = () => {
  const comments = useComments();
  if (!comments?.sceneId) {
    return null;
  }
  const label = comments.placing ? "Cancel comment" : "Add comment";
  return (
    <button
      type="button"
      // keep the (undocked) comments sidebar open while adding a comment
      data-prevent-outside-click
      className={`app-footer-button${comments.placing ? " is-active" : ""}`}
      aria-label={label}
      aria-pressed={comments.placing}
      title={label}
      onClick={() => {
        comments.setDraft(null);
        comments.select(null);
        comments.setPlacing(!comments.placing);
      }}
    >
      <CommentIcon width={18} height={18} />
    </button>
  );
};

export const AppFooter = React.memo(
  ({ onChange }: { onChange: () => void }) => {
    return (
      <Footer>
        <div
          className={IS_SELF_HOSTED ? "app-footer-self-hosted" : undefined}
          style={{
            display: "flex",
            gap: ".5rem",
            alignItems: "center",
          }}
        >
          {IS_SELF_HOSTED && <AddCommentButton />}
          <div
            style={{
              display: "flex",
              gap: ".5rem",
              alignItems: "center",
              marginInlineStart: IS_SELF_HOSTED ? "auto" : undefined,
            }}
          >
            {isVisualDebuggerEnabled() && <DebugFooter onChange={onChange} />}
            {!isExcalidrawPlusSignedUser && <EncryptedIcon />}
          </div>
        </div>
      </Footer>
    );
  },
);
