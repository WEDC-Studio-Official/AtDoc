
@details[]

styles
排版 
靠左對齊
置中 
靠右對齊 
左右對齊 
分散對齊

inline-syntax
高亮 @mark{styles}[]

底線 @underline[]

粗體 @bold[]

斜體 @italic[]

換行 @n 

逃逸 @+任意語法 @@=@

行內程式碼塊 @raw[]

上標@sup[]

下標@sub[]

註腳引用@note[1]

註腳內容@notes(1)[]

刪除線@del[]

鍵盤按鍵@kbd[]

tips:在這裡只要滑鼠一進[]內部按下鍵盤任一案件即可自動填入

```ebnf
inline-node
    = mark
    | bold
    | italic
    | underline
    | del
    | raw
    | sup
    | sub
    | note
    | kbd
    ;

mark
    = "@mark" styles? content ;

bold
    = "@bold" content ;

italic
    = "@italic" content ;

underline
    = "@underline" content ;

del
    = "@del" content ;

raw
    = "@raw" content ;

sup
    = "@sup" content ;

sub
    = "@sub" content ;

note
    = "@note" "[" integer "]" ;

notes
    = "@notes" modifier content ;

kbd
    = "@kbd" "[" key "]" ;

content
    = "[" text "]" ;

modifier
    = "(" text ")" ;

styles
    = "{" text "}" ;

```