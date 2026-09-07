-- Rich text: template bodies become HTML instead of plain text.
--
-- messages.body_html is already HTML on every existing row (it was derived
-- from body_text at compose time), so only templates need converting.
-- Idempotent: a body that already starts with a tag is left alone.

begin;

update templates
set body_tpl =
  '<p>' ||
  replace(
    replace(
      replace(
        replace(
          replace(
            replace(body_tpl, '&', '&amp;'),
          '<', '&lt;'),
        '>', '&gt;'),
      E'\r', ''),
    E'\n\n', '</p><p>'),
  E'\n', '<br />')
  || '</p>'
where body_tpl is not null
  and body_tpl <> ''
  and body_tpl not like '<%';

-- An empty template body still needs to be valid HTML for the editor.
update templates set body_tpl = '<p></p>'
where body_tpl is null or body_tpl = '';

commit;
