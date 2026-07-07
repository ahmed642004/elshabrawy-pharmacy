-- Arabic display labels for categories (storefront i18n).
-- The English `label` stays the source of truth for admin (kept LTR/English);
-- `label_ar` is the customer-facing Arabic label, picked by locale on the storefront.
alter table categories add column if not exists label_ar text;

update categories set label_ar = 'العناية بالبشرة'   where id = 'skincare';
update categories set label_ar = 'الفيتامينات'        where id = 'vitamins';
update categories set label_ar = 'المكملات الغذائية'  where id = 'supplements';
update categories set label_ar = 'العناية بالشعر'     where id = 'hair';
update categories set label_ar = 'العناية الشخصية'    where id = 'personal';
update categories set label_ar = 'الأجهزة الصحية'     where id = 'devices';
