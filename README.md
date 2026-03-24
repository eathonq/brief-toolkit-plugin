# brief toolkit plugin

📖 [中文文档](README-zh-CN.md)

## Getting Started

### [I18n Panel]
The I18n Panel provides an interface for managing and editing internationalization resources in your project.
You can add/migrate multi-language resource directories, and create, set templates, sync, open, and delete i18n resource files in this panel.

- **Add language directory**: Creates a new directory under `resources` and generates a `.schema.json` language template.
- **Migrate language directory**: Moves files from the original directory to the new one.

- **Add resource file**: Creates a new i18n resource file in the current directory and sets its `meta` properties.
- **Set template**: Formats the i18n resource file in the current directory according to the specified template.
- **Sync resource file**: Uses the current directory's i18n resource file as the standard to sync with other i18n files in the same directory — adding new properties and removing obsolete ones.
- **Open resource file**: Opens the i18n resource file in the editor.
- **Delete resource file**: Deletes the i18n resource file from the current directory.

### [Guide Panel]
The Guide Panel provides an interface for managing and editing tutorial/guide resources in your project.
You can add/migrate guide resource directories, and create, open, and delete guide resource files in this panel.

- **Add guide directory**: Creates a new directory under `resources` and generates a `.schema.json` guide template.
- **Migrate guide directory**: Moves files from the original directory to the new one.
- **Add guide file**: Creates a new guide resource file in the current directory and sets its `key` property.

## BriefToolkit Component Groups
BriefToolkit component groups provide a set of commonly used components to help developers more easily manage internationalization and guide resources.

### Guide Component Group
Provides an interface to display guide resource content, supporting multi-language display and guide switching.
- **GuideManager**
  Manages guide tasks, including task startup, loading, and record querying.

### I18n Component Group
Provides an interface to display internationalization resource content, supporting multi-language display and i18n resource switching.
- **LocalizedLabel**
  Implements localized text functionality, supporting `Label`, `RichText`, and `EditBox` components.
- **LocalizedManager**
  Implements language switching functionality, supporting modification of the default language resource and resource path in editor mode.
- **LocalizedSprite**
  Implements localized image functionality, supporting the `Sprite` component.

### Mvvm Component Group
Provides commonly used components to help developers manage data binding more easily.
- **Binding**
  Binds component element values to data properties with configurable binding modes. Supports two-way binding, one-way binding, and one-time binding, suitable for different use cases.
- **DataContext**
  Binds object data from a parent data source to a component, providing data context management.
- **ItemsSource**
  Binds collection data from a parent data source to a component, providing data collection management.
- **ViewModel**
  Manages data binding and lifecycle of the view model.

### UIM Component Group
Provides commonly used components to help developers manage UI more easily.
- **AudioManager**
  Implements audio management, including playback, pause, stop, and volume control for background music and sound effects.
- **MessageBoxBase**
  Provides the base functionality for message boxes, including displaying a title, content, and various button types, and handling user interaction results.
- **SkinManager**
  Implements skin management, including theme switching, skin item activation, and state management.
- **SkinSprite**
  Displays skin-related sprites in Cocos Creator, automatically loading the corresponding `SpriteFrame` based on the specified skin identifier.
- **TooltipBase**
  Provides base tooltip functionality, including displaying content text and a close button, and handling user interaction results.
- **TooltipMultiple**
  Provides multi-tooltip functionality, including displaying multiple tooltip instances and managing their display order and close operations.
- **ViewBase**
  Provides base view functionality, including view type, cache options, and basic close/back event handling, serving as a unified foundation for other concrete view components.
- **ViewManager**
  Implements the `IViewManager` interface, providing core view management features including show, hide, close, and data notification, with support for layered management (View, MessageBox, Tooltip). Developers can conveniently manage all types of views in the project and configure default views and prefab lists in the editor.
- **ViewSort**
  Provides view sorting binding functionality. Controls the display order of views across different layers by setting a sort index, ensuring UI elements are rendered in the expected hierarchy.