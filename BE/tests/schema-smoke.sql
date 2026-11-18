-- Run on the disposable development database after migrations.
-- Fixtures are rolled back even when an assertion fails.
DROP PROCEDURE IF EXISTS schema_smoke;
DELIMITER //
CREATE PROCEDURE schema_smoke()
BEGIN
  DECLARE rejected BOOLEAN DEFAULT FALSE;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;
  START TRANSACTION;
  INSERT INTO users (id,email,username,display_name) VALUES
    ('test-user-a','schema-a@example.invalid','schema_test_a','ทดสอบ'),
    ('test-user-b','schema-b@example.invalid','schema_test_b','Test B'),
    ('test-user-c','schema-c@example.invalid','schema_test_c','Test C');
  INSERT INTO restaurants (id,user_id,name) VALUES
    ('test-restaurant-a','test-user-a','ร้านอาหารไทย'),
    ('test-restaurant-b','test-user-b','Test B');
  INSERT INTO restaurant_likes (user_id,restaurant_id) VALUES ('test-user-b','test-restaurant-a');
  BEGIN
    DECLARE CONTINUE HANDLER FOR 1062 SET rejected = TRUE;
    INSERT INTO restaurant_likes (user_id,restaurant_id) VALUES ('test-user-b','test-restaurant-a');
  END;
  IF NOT rejected THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Duplicate like accepted'; END IF;

  SET rejected = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR 3819 SET rejected = TRUE;
    INSERT INTO restaurant_ratings (user_id,restaurant_id,score) VALUES ('test-user-b','test-restaurant-a',6);
  END;
  IF NOT rejected THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid rating accepted'; END IF;

  INSERT INTO comments (id,restaurant_id,user_id,content) VALUES ('test-comment','test-restaurant-a','test-user-a','อาหารอร่อย');
  SET rejected = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR 1452 SET rejected = TRUE;
    INSERT INTO comments (id,restaurant_id,user_id,parent_id,content)
    VALUES ('test-reply','test-restaurant-b','test-user-b','test-comment','Wrong restaurant');
  END;
  IF NOT rejected THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cross-restaurant reply accepted'; END IF;

  INSERT INTO media_objects (id,owner_id,bucket,object_key,mime_type,size_bytes,width,height,status) VALUES
    ('test-media-a','test-user-a','restaurant-images','test/a.webp','image/webp',100,10,10,'READY'),
    ('test-media-b','test-user-a','restaurant-images','test/b.webp','image/webp',100,10,10,'READY');
  INSERT INTO restaurant_images (id,restaurant_id,media_id,is_cover)
  VALUES ('test-image-a','test-restaurant-a','test-media-a',TRUE);
  SET rejected = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR 1062 SET rejected = TRUE;
    INSERT INTO restaurant_images (id,restaurant_id,media_id,is_cover)
    VALUES ('test-image-b','test-restaurant-a','test-media-b',TRUE);
  END;
  IF NOT rejected THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Second cover accepted'; END IF;

  INSERT INTO conversations (id,user_low_id,user_high_id) VALUES
    ('test-chat-a','test-user-a','test-user-b'), ('test-chat-b','test-user-a','test-user-c');
  INSERT INTO conversation_members (conversation_id,user_id) VALUES
    ('test-chat-a','test-user-a'), ('test-chat-a','test-user-b'), ('test-chat-b','test-user-a');
  INSERT INTO messages (id,conversation_id,sender_id,client_message_id,content)
  VALUES ('test-message','test-chat-a','test-user-a','test-client-id','Hello');
  SET rejected = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR 1062 SET rejected = TRUE;
    INSERT INTO messages (id,conversation_id,sender_id,client_message_id,content)
    VALUES ('test-message-retry','test-chat-a','test-user-a','test-client-id','Hello');
  END;
  IF NOT rejected THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Duplicate message accepted'; END IF;
  SET rejected = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR 1452 SET rejected = TRUE;
    INSERT INTO messages (id,conversation_id,sender_id,client_message_id,content)
    VALUES ('test-outsider-message','test-chat-a','test-user-c','test-outsider-client','Hello');
  END;
  IF NOT rejected THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Non-member sender accepted'; END IF;
  SET rejected = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR 1452 SET rejected = TRUE;
    UPDATE conversation_members SET last_read_message_id='test-message' WHERE conversation_id='test-chat-b';
  END;
  IF NOT rejected THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cross-conversation read cursor accepted'; END IF;
  ROLLBACK;
  SELECT 'Schema smoke tests passed' AS result;
END//
DELIMITER ;
CALL schema_smoke();
DROP PROCEDURE schema_smoke;
