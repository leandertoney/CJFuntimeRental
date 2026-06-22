-- Migration: Add email_templates to site_config
-- Phase 1: Email Automation
-- Created: 2026-06-22
--
-- This migration adds default email templates to the site_config JSONB structure
-- so admin can edit email content from the dashboard.

UPDATE public.site_config
SET config = config || jsonb_build_object(
  'email_templates', jsonb_build_object(
    'booking_confirmation', jsonb_build_object(
      'enabled', true,
      'subject', 'Your CJ''s Fun Time Rental Booking Confirmation',
      'body', 'Hi {{firstName}},

Thank you for booking with CJ''s Fun Time Rental! We''re excited to see you soon.

**Your Booking:**
• Vehicle: {{vehicleName}}
• Rental Period: {{startDate}} to {{endDate}} ({{days}} day{{daysPlural}})
• Total: ${{total}}{{savingsLine}}

**What''s Next:**
You''ll receive pickup instructions 48 hours before your rental begins with details on where to pick up the {{vehicleName}} and what to bring.

If you have any questions, just reply to this email or call us at (717) 123-4567.

See you soon!
– Chris & the CJ''s Fun Time Rental team'
    ),
    'owner_alert', jsonb_build_object(
      'enabled', true,
      'subject', '🔔 New booking: {{vehicleName}} — {{startDate}}',
      'body', '**New Booking Received**

**Customer:**
• Name: {{name}}
• Email: {{email}}
• Phone: {{phone}}

**Rental:**
• Vehicle: {{vehicleName}}
• Dates: {{startDate}} to {{endDate}} ({{days}} day{{daysPlural}})
• Total: ${{total}}

**Action Required:**
Log into the admin panel to set pickup location and time for this booking.

View booking: https://cjfuntimerentals.com/admin'
    ),
    'welcome', jsonb_build_object(
      'enabled', true,
      'subject', 'Welcome to CJ''s Fun Time Rental! Prepare for your adventure',
      'body', 'Hi {{firstName}},

Thanks for booking your {{vehicleName}} with us! We wanted to share a few tips to help you get the most out of your adventure.

**Before You Arrive:**
• Bring a valid driver''s license
• Wear comfortable clothes and closed-toe shoes
• Check the weather forecast and dress accordingly
• Arrive 15 minutes early for a brief orientation

**During Your Rental:**
• Helmets and safety gear are provided
• Fuel level should match pickup level at return
• Call us anytime if you need assistance: (717) 123-4567

**Need Route Suggestions?**
Lancaster County has amazing scenic drives! Ask us for our favorite routes when you arrive.

We can''t wait to see you!
– Chris & the team'
    ),
    'pickup_reminder', jsonb_build_object(
      'enabled', true,
      'subject', 'Your {{vehicleName}} is ready! Pickup details inside',
      'body', 'Hi {{firstName}},

Your rental begins tomorrow! Here''s everything you need to know:

**Pickup Details:**
• Location: {{pickupLocation}}
• Address: {{pickupAddress}}
• Time: {{pickupTime}}
• Fuel Level: {{fuelLevel}}

**Instructions:**
{{pickupInstructions}}

**What to Bring:**
• Valid driver''s license
• Credit card on file
• Comfortable closed-toe shoes
• Sunglasses and sunscreen

**Questions?**
Call or text us: (717) 123-4567

Safe travels!
– Chris'
    ),
    'return_instructions', jsonb_build_object(
      'enabled', true,
      'subject', 'Return instructions for your {{vehicleName}} rental',
      'body', 'Hi {{firstName}},

Hope you''re having an amazing time with the {{vehicleName}}! Your rental ends tomorrow.

**Return Details:**
• Location: {{returnLocation}}
• Address: {{returnAddress}}
• Time: {{returnTime}}
• Fuel Level: Return with {{fuelLevel}}

**Instructions:**
{{returnInstructions}}

{{keyDropInstructions}}

**Before You Return:**
• Fill fuel to match pickup level ({{fuelLevel}})
• Remove all personal belongings
• Park in designated area
• Lock the vehicle

Thanks for riding with us! We''d love to hear about your experience.

– Chris & the team'
    ),
    'mid_rental_checkin', jsonb_build_object(
      'enabled', true,
      'subject', 'How''s your {{vehicleName}} adventure going?',
      'body', 'Hi {{firstName}},

Just checking in! Hope you''re enjoying the {{vehicleName}}.

**Need Anything?**
If you have questions or need assistance, we''re here to help:
• Call/Text: (717) 123-4567
• Email: Just reply to this message

**Reminder:**
Your rental continues through {{endDate}}. Return details will be sent tomorrow.

**Having Fun?**
We''d love to see photos of your adventure! Tag us on social media or share your experience.

Enjoy the ride!
– Chris'
    )
  )
)
WHERE id = 1;

-- Verify the update
SELECT
  CASE
    WHEN config ? 'email_templates' THEN '✅ email_templates added successfully'
    ELSE '❌ email_templates not found'
  END as status
FROM public.site_config
WHERE id = 1;
