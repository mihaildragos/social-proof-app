import React from "react";
import { cn } from "@/lib/utils";
import { VariantProps, cva } from "class-variance-authority";
import { X } from "lucide-react";

// Define the variants for the notification component
const notificationVariants = cva(
  "fixed shadow-lg rounded-lg p-4 max-w-sm transition-all duration-300 z-50 flex flex-col gap-2 overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-white text-gray-800 border border-gray-200",
        success: "bg-green-50 text-green-900 border border-green-200",
        warning: "bg-amber-50 text-amber-900 border border-amber-200",
        error: "bg-red-50 text-red-900 border border-red-200",
        info: "bg-blue-50 text-blue-900 border border-blue-200",
        order: "bg-white text-gray-800 border border-blue-200",
      },
      position: {
        "top-left": "top-4 left-4",
        "top-right": "top-4 right-4",
        "bottom-left": "bottom-4 left-4",
        "bottom-right": "bottom-4 right-4",
        "top-center": "top-4 left-1/2 -translate-x-1/2",
        "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
      },
      animation: {
        fade: "",
        slide: "",
        bounce: "",
      },
      isVisible: {
        true: "opacity-100",
        false: "opacity-0 pointer-events-none",
      },
    },
    defaultVariants: {
      variant: "default",
      position: "bottom-left",
      animation: "fade",
      isVisible: false,
    },
  }
);

// Animation keyframe styles for different animations
const animationClasses = {
  fade: {
    enter: "animate-fadeIn",
    exit: "animate-fadeOut",
  },
  slide: {
    "top-left": "animate-slideInFromLeft",
    "top-right": "animate-slideInFromRight",
    "bottom-left": "animate-slideInFromLeft",
    "bottom-right": "animate-slideInFromRight",
    "top-center": "animate-slideInFromTop",
    "bottom-center": "animate-slideInFromBottom",
    exit: "animate-slideOut",
  },
  bounce: {
    enter: "animate-bounceIn",
    exit: "animate-bounceOut",
  },
};

// Define the props interface for the notification component
export interface NotificationProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "content">,
    VariantProps<typeof notificationVariants> {
  title?: string;
  message?: string;
  content?: React.ReactNode;
  image?: string;
  onClose?: () => void;
  showClose?: boolean;
  autoClose?: boolean;
  autoCloseDelay?: number;
  html?: string;
}

export function NotificationPopup({
  className,
  variant,
  position,
  animation = "fade",
  isVisible = true,
  title,
  message,
  content,
  image,
  onClose,
  showClose = true,
  autoClose = true,
  autoCloseDelay = 5000,
  html,
  ...props
}: NotificationProps) {
  // Auto-close timer
  React.useEffect(() => {
    if (autoClose && isVisible) {
      const timer = setTimeout(() => {
        onClose?.();
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [autoClose, autoCloseDelay, isVisible, onClose]);

  // Get the animation class based on position
  const getAnimationClass = () => {
    if (!animation || !isVisible) return "";

    if (animation === "slide" && position) {
      return animationClasses.slide[position as keyof typeof animationClasses.slide] || "";
    }

    if (animation === "fade") {
      return animationClasses.fade.enter;
    }

    if (animation === "bounce") {
      return animationClasses.bounce.enter;
    }

    return "";
  };

  return (
    <div
      className={cn(
        notificationVariants({ variant, position, animation, isVisible }),
        getAnimationClass(),
        className
      )}
      role="alert"
      aria-live="assertive"
      {...props}
    >
      {showClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 text-gray-500 hover:text-gray-900 focus:outline-none"
          aria-label="Close notification"
        >
          <X size={16} />
        </button>
      )}

      <div className="flex gap-3">
        {image && (
          <div className="flex-shrink-0">
            <img
              src={image}
              alt=""
              className="h-12 w-12 rounded-md object-cover"
            />
          </div>
        )}

        <div className="flex flex-col">
          {title && <h3 className="text-sm font-medium">{title}</h3>}

          {message && <div className="mt-1 text-sm opacity-90">{message}</div>}

          {content && <div className="mt-1">{content}</div>}

          {html && (
            <div
              className="mt-1"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
